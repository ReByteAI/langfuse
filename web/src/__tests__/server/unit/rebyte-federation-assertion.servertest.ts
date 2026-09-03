import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  isRebyteFederatedSignInAllowed,
  selectRebyteFederationProviders,
  signRebyteFederationAssertion,
  verifyRebyteFederationAssertion,
} from "@/src/features/rebyte-federation/server/assertion";
import {
  signRebyteRevocationAssertion,
  verifyRebyteRevocationAssertion,
} from "@/src/features/rebyte-federation/server/revocation";

const secret = "a".repeat(64);

const validClaims = {
  version: 1 as const,
  issuer: "rebyte" as const,
  audience: "langfuse" as const,
  clerkUserId: "user_test",
  clerkOrganizationId: "org_test",
  accountId: "org_test",
  organizationName: "Test organization",
  destination: "traces" as const,
  issuedAt: 1_800_000_000,
  expiresAt: 1_800_000_060,
  nonce: crypto.randomUUID(),
};

describe("Rebyte federation assertion", () => {
  it("accepts a valid organization-scoped administrator assertion", () => {
    const token = signRebyteFederationAssertion(validClaims, secret);

    expect(
      verifyRebyteFederationAssertion(token, secret, 1_800_000_030),
    ).toEqual(validClaims);
  });

  it("rejects a tampered tenant binding", () => {
    const token = signRebyteFederationAssertion(validClaims, secret);
    const [payload, signature] = token.split(".");
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    decoded.accountId = "org_other";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString(
      "base64url",
    );

    expect(() =>
      verifyRebyteFederationAssertion(
        `${tamperedPayload}.${signature}`,
        secret,
        1_800_000_030,
      ),
    ).toThrow("Invalid Rebyte federation assertion");
  });

  it("rejects expired and overly long assertions", () => {
    const expired = signRebyteFederationAssertion(validClaims, secret);
    expect(() =>
      verifyRebyteFederationAssertion(expired, secret, 1_800_000_061),
    ).toThrow("Expired Rebyte federation assertion");
    expect(() =>
      signRebyteFederationAssertion(
        { ...validClaims, expiresAt: validClaims.issuedAt + 61 },
        secret,
      ),
    ).toThrow("Assertion lifetime exceeds the allowed window");
  });

  it("rejects the wrong audience and weak shared secrets", () => {
    const wrongAudience = signRebyteFederationAssertion(
      { ...validClaims, audience: "langfuse" },
      secret,
    );
    const [payload, signature] = wrongAudience.split(".");
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    decoded.audience = "other";
    const otherPayload = Buffer.from(JSON.stringify(decoded)).toString(
      "base64url",
    );

    expect(() =>
      verifyRebyteFederationAssertion(
        `${otherPayload}.${signature}`,
        secret,
        1_800_000_030,
      ),
    ).toThrow("Invalid Rebyte federation assertion");
    expect(() => signRebyteFederationAssertion(validClaims, "short")).toThrow(
      "Rebyte federation secret must contain at least 32 characters",
    );
  });

  it("requires a matching Clerk subject for federated custom OIDC", () => {
    expect(
      isRebyteFederatedSignInAllowed({
        federationEnabled: true,
        provider: "custom",
        providerAccountId: validClaims.clerkUserId,
        claims: validClaims,
      }),
    ).toBe(true);
    expect(
      isRebyteFederatedSignInAllowed({
        federationEnabled: true,
        provider: "custom",
        providerAccountId: "user_other",
        claims: validClaims,
      }),
    ).toBe(false);
    expect(
      isRebyteFederatedSignInAllowed({
        federationEnabled: true,
        provider: "custom",
        providerAccountId: validClaims.clerkUserId,
        claims: undefined,
      }),
    ).toBe(false);
  });

  it("rejects other identity providers for federated deployments", () => {
    expect(
      isRebyteFederatedSignInAllowed({
        federationEnabled: true,
        provider: "github",
        providerAccountId: undefined,
        claims: undefined,
      }),
    ).toBe(false);
  });

  it("does not affect disabled deployments", () => {
    expect(
      isRebyteFederatedSignInAllowed({
        federationEnabled: false,
        provider: "custom",
        providerAccountId: undefined,
        claims: undefined,
      }),
    ).toBe(true);
  });

  it("exposes only the custom OIDC provider in federation mode", () => {
    const providers = [
      { id: "credentials", name: "Credentials" },
      { id: "github", name: "GitHub" },
      { id: "custom", name: "Clerk" },
    ];

    expect(
      selectRebyteFederationProviders({
        federationEnabled: true,
        providers,
      }),
    ).toEqual([{ id: "custom", name: "Clerk" }]);
    expect(
      selectRebyteFederationProviders({
        federationEnabled: false,
        providers,
      }),
    ).toEqual(providers);
  });

  it("binds revocations to their action, tenant, user, and short lifetime", () => {
    const claims = {
      version: 1 as const,
      issuer: "rebyte" as const,
      audience: "langfuse" as const,
      action: "revoke" as const,
      clerkUserId: validClaims.clerkUserId,
      accountId: validClaims.accountId,
      issuedAt: validClaims.issuedAt,
      expiresAt: validClaims.expiresAt,
      nonce: crypto.randomUUID(),
    };
    const token = signRebyteRevocationAssertion(claims, secret);

    expect(
      verifyRebyteRevocationAssertion(token, secret, 1_800_000_030),
    ).toEqual(claims);
    expect(() =>
      verifyRebyteRevocationAssertion(token, secret, 1_800_000_061),
    ).toThrow("Expired Rebyte revocation assertion");
  });
});
