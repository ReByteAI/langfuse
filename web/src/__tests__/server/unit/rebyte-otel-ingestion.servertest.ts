import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";

import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureProject: vi.fn(),
  processIngestion: vi.fn(),
  markProject: vi.fn(),
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    disconnect: vi.fn(),
    status: "end",
  },
}));

vi.mock("@/src/env.mjs", () => ({
  env: {
    REBYTE_FEDERATION_SECRET: "a".repeat(64),
    LANGFUSE_OTEL_INGESTION_MAX_BODY_BYTES: 1024 * 1024,
    LANGFUSE_INGESTION_MASKING_PROPAGATED_HEADERS: [],
  },
}));
vi.mock("@/src/features/rebyte-federation/server/access", () => ({
  ensureRebyteOrganizationProject: mocks.ensureProject,
}));
vi.mock("@/src/server/otel/processOtelIngestion", () => ({
  processOtelIngestion: mocks.processIngestion,
}));
vi.mock("@langfuse/shared/src/server", () => ({
  ClickHouseClientManager: {
    getInstance: () => ({ closeAllConnections: vi.fn() }),
  },
  getCurrentSpan: vi.fn(),
  getLangfuseHeaderValue: (
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) => (typeof headers[name] === "string" ? headers[name] : undefined),
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  markProjectAsOtelUser: mocks.markProject,
  recordIncrement: vi.fn(),
  redis: mocks.redis,
}));

import {
  sha256RebyteIngestionBody,
  signRebyteIngestionAssertion,
} from "@/src/features/rebyte-federation/server/ingestion";
import handler from "@/src/pages/api/internal/rebyte-federation/otel/v1/traces";

const secret = "a".repeat(64);
const body = Buffer.from('{"resourceSpans":[]}');

const assertion = () => {
  const issuedAt = Math.floor(Date.now() / 1_000);
  return signRebyteIngestionAssertion(
    {
      version: 1,
      issuer: "rebyte",
      audience: "langfuse",
      action: "ingest-otel-traces",
      accountId: "org_test",
      contentType: "application/json",
      bodySha256: sha256RebyteIngestionBody(body),
      issuedAt,
      expiresAt: issuedAt + 60,
      nonce: crypto.randomUUID(),
    },
    secret,
  );
};

function request(token = assertion()) {
  const stream = new PassThrough() as PassThrough &
    IncomingMessage &
    NextApiRequest;
  stream.method = "POST";
  stream.headers = {
    "content-type": "application/json",
    "content-length": String(body.byteLength),
    "x-rebyte-ingestion-assertion": token,
  };
  return stream;
}

function response() {
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    status: vi.fn((statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    }),
    json: vi.fn((value: unknown) => value),
  };
  return res as unknown as NextApiResponse & typeof res;
}

async function send(req: ReturnType<typeof request>, payload = body) {
  const res = response();
  const result = handler(req, res);
  req.end(payload);
  await result;
  return res;
}

describe("Rebyte OTLP ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redis.set.mockResolvedValue("OK");
    mocks.ensureProject.mockResolvedValue({
      organizationId: "rebyte-org-test",
      projectId: "rebyte-project-test",
    });
    mocks.processIngestion.mockResolvedValue({ kind: "ok" });
  });

  it("derives the destination project from the signed Rebyte account", async () => {
    const res = await send(request());

    expect(res.statusCode).toBe(200);
    expect(mocks.ensureProject).toHaveBeenCalledWith({
      accountId: "org_test",
    });
    expect(mocks.processIngestion).toHaveBeenCalledWith(
      expect.objectContaining({
        body,
        contentType: "application/json",
        config: expect.objectContaining({
          orgId: "rebyte-org-test",
          projectId: "rebyte-project-test",
        }),
      }),
    );
  });

  it("rejects a body that does not match the tenant assertion", async () => {
    const res = await send(request(), Buffer.from('{"resourceSpans":[{}]}'));

    expect(res.statusCode).toBe(401);
    expect(mocks.ensureProject).not.toHaveBeenCalled();
    expect(mocks.processIngestion).not.toHaveBeenCalled();
  });

  it("accepts an identical completed retry without ingesting it twice", async () => {
    mocks.redis.set.mockResolvedValueOnce(null);
    mocks.redis.get.mockResolvedValueOnce(
      `done:${sha256RebyteIngestionBody(body)}`,
    );

    const res = await send(request());

    expect(res.statusCode).toBe(200);
    expect(mocks.processIngestion).not.toHaveBeenCalled();
  });

  it("releases the nonce when ingestion fails so the exporter can retry", async () => {
    mocks.processIngestion.mockRejectedValueOnce(
      new Error("queue unavailable"),
    );
    mocks.redis.get.mockResolvedValueOnce(
      `processing:${sha256RebyteIngestionBody(body)}`,
    );

    const res = await send(request());

    expect(res.statusCode).toBe(500);
    expect(mocks.redis.del).toHaveBeenCalledOnce();
  });
});
