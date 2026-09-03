import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "@/src/env.mjs";
import { ensureRebyteOrganizationProject } from "@/src/features/rebyte-federation/server/access";
import {
  type RebyteIngestionClaims,
  verifyRebyteIngestionAssertion,
  verifyRebyteIngestionBody,
} from "@/src/features/rebyte-federation/server/ingestion";
import {
  gunzipOtelRequestBody,
  handleOtelRequestBodyTooLarge,
  OtelRequestBodyTooLargeError,
  readOtelRequestBody,
} from "@/src/server/otel/otelRequestBody";
import { processOtelIngestion } from "@/src/server/otel/processOtelIngestion";
import {
  getLangfuseHeaderValue,
  logger,
  markProjectAsOtelUser,
  redis,
} from "@langfuse/shared/src/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ASSERTION_HEADER = "x-rebyte-ingestion-assertion";
const NONCE_KEY_PREFIX = "rebyte-federation:ingestion:";

const getRequestContentType = (req: NextApiRequest) =>
  req.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();

const getRequestContentEncoding = (req: NextApiRequest) =>
  req.headers["content-encoding"]?.includes("gzip") ? "gzip" : undefined;

const releaseNonce = async (key: string, processingValue: string) => {
  if (!redis) return;
  try {
    if ((await redis.get(key)) === processingValue) await redis.del(key);
  } catch (error) {
    logger.error("Failed to release Rebyte ingestion nonce", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const secret = env.REBYTE_FEDERATION_SECRET;
  if (!secret || !redis) {
    return res.status(503).json({ message: "Ingestion unavailable" });
  }

  const assertionHeader = req.headers[ASSERTION_HEADER];
  if (typeof assertionHeader !== "string") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let claims: RebyteIngestionClaims;
  try {
    claims = verifyRebyteIngestionAssertion(assertionHeader, secret);
  } catch (error) {
    logger.warn("Rejected Rebyte trace ingestion assertion", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  const contentType = getRequestContentType(req);
  const contentEncoding = getRequestContentEncoding(req);
  if (
    contentType !== claims.contentType ||
    contentEncoding !== claims.contentEncoding
  ) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let encodedBody: Buffer;
  try {
    encodedBody = await readOtelRequestBody(
      req,
      env.LANGFUSE_OTEL_INGESTION_MAX_BODY_BYTES,
    );
    verifyRebyteIngestionBody(encodedBody, claims.bodySha256);
  } catch (error) {
    if (error instanceof OtelRequestBodyTooLargeError) {
      return handleOtelRequestBodyTooLarge(
        error,
        req,
        res,
        "rebyte-federation",
      );
    }
    logger.warn("Rejected Rebyte trace ingestion body", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  const nowSeconds = Math.floor(Date.now() / 1_000);
  const ttlSeconds = Math.max(1, claims.expiresAt - nowSeconds + 10);
  const nonceKey = `${NONCE_KEY_PREFIX}${claims.nonce}`;
  const processingValue = `processing:${claims.bodySha256}`;
  const doneValue = `done:${claims.bodySha256}`;
  try {
    const claimed = await redis.set(
      nonceKey,
      processingValue,
      "EX",
      ttlSeconds,
      "NX",
    );
    if (claimed !== "OK") {
      const existing = await redis.get(nonceKey);
      if (existing === doneValue) return res.status(200).json({});
      return res.status(409).json({ message: "Ingestion already in progress" });
    }
  } catch (error) {
    logger.error("Failed to claim Rebyte ingestion nonce", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return res.status(503).json({ message: "Ingestion unavailable" });
  }

  try {
    const { organizationId, projectId } = await ensureRebyteOrganizationProject(
      { accountId: claims.accountId },
    );
    await markProjectAsOtelUser(projectId);

    let body = encodedBody;
    if (contentEncoding === "gzip") {
      body = await gunzipOtelRequestBody(
        body,
        env.LANGFUSE_OTEL_INGESTION_MAX_BODY_BYTES,
      );
    }

    const propagatedHeaders: Record<string, string> = {};
    for (const headerName of env.LANGFUSE_INGESTION_MASKING_PROPAGATED_HEADERS) {
      const value = req.headers[headerName];
      if (typeof value === "string") propagatedHeaders[headerName] = value;
    }

    const result = await processOtelIngestion({
      body,
      contentType,
      encodedBodyBytes: encodedBody.byteLength,
      config: {
        projectId,
        orgId: organizationId,
        publicKey: `rebyte:${projectId}`,
        propagatedHeaders:
          Object.keys(propagatedHeaders).length > 0
            ? propagatedHeaders
            : undefined,
        sdkName:
          getLangfuseHeaderValue(req.headers, "x-langfuse-sdk-name") ??
          "rebyte-cctools",
        sdkVersion:
          getLangfuseHeaderValue(req.headers, "x-langfuse-sdk-version") ??
          "unknown",
        rejectionSdkName: req.headers["x-langfuse-sdk-name"],
        ingestionVersion: getLangfuseHeaderValue(
          req.headers,
          "x-langfuse-ingestion-version",
        ),
      },
    });

    if (result.kind === "http") {
      if (result.status >= 500) {
        await releaseNonce(nonceKey, processingValue);
        return res.status(result.status).json(result.body);
      }

      try {
        await redis.set(nonceKey, doneValue, "EX", ttlSeconds, "XX");
      } catch (error) {
        logger.error("Failed to complete Rebyte ingestion nonce", {
          accountId: claims.accountId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
      return res.status(result.status).json(result.body);
    }

    try {
      await redis.set(nonceKey, doneValue, "EX", ttlSeconds, "XX");
    } catch (error) {
      logger.error("Failed to complete Rebyte ingestion nonce", {
        accountId: claims.accountId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return res.status(200).json(result.body ?? {});
  } catch (error) {
    await releaseNonce(nonceKey, processingValue);
    if (error instanceof OtelRequestBodyTooLargeError) {
      return handleOtelRequestBodyTooLarge(error, req, res, claims.accountId);
    }
    logger.error("Failed to ingest Rebyte traces", {
      accountId: claims.accountId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
