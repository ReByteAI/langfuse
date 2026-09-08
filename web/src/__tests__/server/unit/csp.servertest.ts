import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const getHeaders = (cloudRegion?: string, embedOrigins = "") =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
        const config = (await import("./next.config.mjs")).default;
        const headers = await config.headers();
        if (headers.some((rule) => rule.headers.length === 0)) {
          throw new Error("Next.js rejects empty header rules");
        }
        console.log(JSON.stringify(headers.flatMap((rule) => rule.headers)));
      `,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DOCKER_BUILD: "1",
          LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT: "",
          NEXT_PUBLIC_LANGFUSE_CLOUD_REGION: cloudRegion,
          REBYTE_EMBED_ALLOWED_ORIGINS: embedOrigins,
        },
        encoding: "utf8",
      },
    ),
  ) as { key: string; value: string }[];

const getCsp = (cloudRegion?: string, embedOrigins?: string) =>
  getHeaders(cloudRegion, embedOrigins).find(
    (header) => header.key === "Content-Security-Policy",
  )!.value;

describe("Content Security Policy", () => {
  it("allows the local MinIO endpoint in self-hosted Docker builds", () => {
    expect(getCsp()).toContain("connect-src 'self' http://localhost:*");
  });

  it("does not allow local connections in Cloud", () => {
    expect(getCsp("US")).not.toContain("connect-src 'self' http://localhost:*");
  });

  it("blocks embedding when no parent origins are configured", () => {
    expect(getCsp()).toContain("frame-ancestors 'none';");
    expect(getHeaders()).toContainEqual({
      key: "x-frame-options",
      value: "SAMEORIGIN",
    });
  });

  it("allows only the configured parents while retaining the rest of CSP", () => {
    const headers = getHeaders(
      undefined,
      "https://app.rebyte.ai, http://localhost:3000",
    );
    const csp = headers.find(
      (header) => header.key === "Content-Security-Policy",
    )!.value;
    expect(csp).toContain(
      "frame-ancestors https://app.rebyte.ai http://localhost:3000;",
    );
    expect(csp).toContain("object-src 'none';");
    expect(csp).toContain("form-action 'self'");
    expect(headers.some((header) => header.key === "x-frame-options")).toBe(
      false,
    );
  });

  it("allows every parent when embedding is configured with a wildcard", () => {
    expect(getCsp(undefined, "*")).toContain("frame-ancestors *;");
    expect(
      getHeaders(undefined, "*").some(
        (header) => header.key === "x-frame-options",
      ),
    ).toBe(false);
  });

  it.each([
    "https://*.rebyte.ai",
    "https://app.rebyte.ai/path",
    "https://user:password@app.rebyte.ai",
    "https://app.rebyte.ai; frame-ancestors *",
    "http://app.rebyte.ai",
    "https://app.rebyte.ai:*",
    "http://localhost.evil.test:*",
    "http://192.168.1.1:*",
  ])("rejects an unsafe or ambiguous parent origin: %s", (origin) => {
    expect(() => getHeaders(undefined, origin)).toThrow();
  });
});
