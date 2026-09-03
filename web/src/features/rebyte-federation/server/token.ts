import crypto from "node:crypto";

const MAX_TOKEN_LENGTH = 4_096;

const assertStrongSecret = (secret: string) => {
  if (secret.length < 32) {
    throw new Error(
      "Rebyte federation secret must contain at least 32 characters",
    );
  }
};

const signatureFor = (encodedPayload: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(encodedPayload, "utf8").digest();

export const signRebyteFederationPayload = (
  payload: unknown,
  secret: string,
): string => {
  assertStrongSecret(secret);
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signatureFor(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
};

export const verifyRebyteFederationPayload = (
  token: string,
  secret: string,
): unknown => {
  assertStrongSecret(secret);
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error("Invalid Rebyte federation assertion");
  }

  const segments = token.split(".");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error("Invalid Rebyte federation assertion");
  }

  const [encodedPayload, encodedSignature] = segments;
  const providedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = signatureFor(encodedPayload, secret);
  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new Error("Invalid Rebyte federation assertion");
  }

  try {
    return JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;
  } catch {
    throw new Error("Invalid Rebyte federation assertion");
  }
};
