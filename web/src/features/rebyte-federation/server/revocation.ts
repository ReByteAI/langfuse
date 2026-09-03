import { z } from "zod";

import {
  signRebyteFederationPayload,
  verifyRebyteFederationPayload,
} from "./token";

const MAX_ASSERTION_LIFETIME_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 10;

export const rebyteRevocationClaimsSchema = z
  .object({
    version: z.literal(1),
    issuer: z.literal("rebyte"),
    audience: z.literal("langfuse"),
    action: z.literal("revoke"),
    clerkUserId: z
      .string()
      .regex(/^user_[A-Za-z0-9_-]+$/)
      .max(128),
    accountId: z
      .string()
      .regex(/^(?:org|acct)_[A-Za-z0-9_-]+$/)
      .max(128),
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

export type RebyteRevocationClaims = z.infer<
  typeof rebyteRevocationClaimsSchema
>;

export const signRebyteRevocationAssertion = (
  claims: RebyteRevocationClaims,
  secret: string,
) =>
  signRebyteFederationPayload(
    rebyteRevocationClaimsSchema.parse(claims),
    secret,
  );

export const verifyRebyteRevocationAssertion = (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): RebyteRevocationClaims => {
  let claims: RebyteRevocationClaims;
  try {
    claims = rebyteRevocationClaimsSchema.parse(
      verifyRebyteFederationPayload(token, secret),
    );
  } catch {
    throw new Error("Invalid Rebyte revocation assertion");
  }

  if (claims.issuedAt > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error("Invalid Rebyte revocation assertion");
  }
  if (claims.expiresAt < nowSeconds) {
    throw new Error("Expired Rebyte revocation assertion");
  }
  return claims;
};
