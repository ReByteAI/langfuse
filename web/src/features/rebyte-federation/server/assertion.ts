import { z } from "zod";

import {
  signRebyteFederationPayload,
  verifyRebyteFederationPayload,
} from "./token";

const MAX_ASSERTION_LIFETIME_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 10;

export const rebyteFederationClaimsSchema = z
  .object({
    version: z.literal(1),
    issuer: z.literal("rebyte"),
    audience: z.literal("langfuse"),
    clerkUserId: z
      .string()
      .regex(/^user_[A-Za-z0-9_-]+$/)
      .max(128),
    clerkOrganizationId: z
      .string()
      .regex(/^org_[A-Za-z0-9_-]+$/)
      .max(128),
    accountId: z
      .string()
      .regex(/^(?:org|acct)_[A-Za-z0-9_-]+$/)
      .max(128),
    organizationName: z.string().trim().min(1).max(100),
    destination: z.literal("traces"),
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

export type RebyteFederationClaims = z.infer<
  typeof rebyteFederationClaimsSchema
>;

export const isRebyteFederatedSignInAllowed = ({
  federationEnabled,
  provider,
  providerAccountId,
  claims,
}: {
  federationEnabled: boolean;
  provider: string | undefined;
  providerAccountId: string | undefined;
  claims: RebyteFederationClaims | undefined;
}) =>
  !federationEnabled ||
  provider !== "custom" ||
  (claims !== undefined && claims.clerkUserId === providerAccountId);

export const signRebyteFederationAssertion = (
  claims: RebyteFederationClaims,
  secret: string,
): string => {
  const parsed = rebyteFederationClaimsSchema.parse(claims);
  return signRebyteFederationPayload(parsed, secret);
};

export const verifyRebyteFederationAssertion = (
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): RebyteFederationClaims => {
  let claims: RebyteFederationClaims;
  try {
    const decoded = verifyRebyteFederationPayload(token, secret);
    claims = rebyteFederationClaimsSchema.parse(decoded);
  } catch {
    throw new Error("Invalid Rebyte federation assertion");
  }

  if (claims.issuedAt > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error("Invalid Rebyte federation assertion");
  }
  if (claims.expiresAt < nowSeconds) {
    throw new Error("Expired Rebyte federation assertion");
  }

  return claims;
};
