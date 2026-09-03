import crypto from "node:crypto";

import { z } from "zod";

import {
  signRebyteFederationPayload,
  verifyRebyteFederationPayload,
} from "./token";

const MAX_ASSERTION_LIFETIME_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 10;

export const rebyteIngestionClaimsSchema = z
  .object({
    version: z.literal(1),
    issuer: z.literal("rebyte"),
    audience: z.literal("langfuse"),
    action: z.literal("ingest-otel-traces"),
    accountId: z
      .string()
      .regex(/^(?:org|acct)_[A-Za-z0-9_-]+$/)
      .max(128),
    contentType: z.enum(["application/json", "application/x-protobuf"]),
    contentEncoding: z.literal("gzip").optional(),
    bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
    issuedAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
    nonce: z.uuid(),
  })
  .strict()
  .refine(
    ({ expiresAt, issuedAt }) =>
      expiresAt >= issuedAt &&
      expiresAt - issuedAt <= MAX_ASSERTION_LIFETIME_SECONDS,
    "Assertion lifetime exceeds the allowed window",
  );

export type RebyteIngestionClaims = z.infer<typeof rebyteIngestionClaimsSchema>;

export const signRebyteIngestionAssertion = (
  claims: RebyteIngestionClaims,
  secret: string,
): string =>
  signRebyteFederationPayload(
    rebyteIngestionClaimsSchema.parse(claims),
    secret,
  );

export const verifyRebyteIngestionAssertion = (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): RebyteIngestionClaims => {
  let claims: RebyteIngestionClaims;
  try {
    claims = rebyteIngestionClaimsSchema.parse(
      verifyRebyteFederationPayload(token, secret),
    );
  } catch {
    throw new Error("Invalid Rebyte ingestion assertion");
  }

  if (claims.issuedAt > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error("Invalid Rebyte ingestion assertion");
  }
  if (claims.expiresAt < nowSeconds) {
    throw new Error("Expired Rebyte ingestion assertion");
  }

  return claims;
};

export const sha256RebyteIngestionBody = (body: Buffer): string =>
  crypto.createHash("sha256").update(body).digest("hex");

export const verifyRebyteIngestionBody = (
  body: Buffer,
  expectedSha256: string,
): void => {
  const actual = Buffer.from(sha256RebyteIngestionBody(body), "hex");
  const expected = Buffer.from(expectedSha256, "hex");
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    throw new Error("Invalid Rebyte ingestion body");
  }
};
