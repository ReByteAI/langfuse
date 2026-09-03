import { useEffect } from "react";
import type { GetServerSideProps } from "next";
import { signIn } from "next-auth/react";

import { env } from "@/src/env.mjs";
import { verifyRebyteFederationAssertion } from "@/src/features/rebyte-federation/server/assertion";
import {
  readRebyteFederationCookie,
  serializeRebyteFederationCookie,
} from "@/src/features/rebyte-federation/server/cookie";
import { LoadingLayout } from "@/src/components/layouts/app-layout/variants/LoadingLayout";
import { redis } from "@langfuse/shared/src/server";

export default function RebyteFederationLogin() {
  useEffect(() => {
    signIn("custom", {
      callbackUrl: `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/rebyte/complete`,
    }).catch(() => undefined);
  }, []);

  return <LoadingLayout message="Opening observability…" />;
}

export const getServerSideProps: GetServerSideProps = async ({
  query,
  req,
  res,
}) => {
  const secret = env.REBYTE_FEDERATION_SECRET;
  if (!secret) return authError("Federation is not configured");

  const assertion = query.assertion;
  if (assertion !== undefined) {
    if (typeof assertion !== "string") {
      return authError("Invalid federation request");
    }

    try {
      const claims = verifyRebyteFederationAssertion(assertion, secret);
      if (!redis) throw new Error("Redis is unavailable");

      const ttlSeconds = Math.max(
        1,
        claims.expiresAt - Math.floor(Date.now() / 1_000) + 10,
      );
      const consumed = await redis.set(
        `rebyte-federation:nonce:${claims.nonce}`,
        "1",
        "EX",
        ttlSeconds,
        "NX",
      );
      if (consumed !== "OK") {
        return authError("Federation request has already been used");
      }

      res.setHeader("Set-Cookie", serializeRebyteFederationCookie(assertion));
      return {
        redirect: {
          destination: `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/rebyte`,
          permanent: false,
        },
      };
    } catch {
      return authError("Invalid or expired federation request");
    }
  }

  const cookieAssertion = readRebyteFederationCookie(req.cookies);
  if (!cookieAssertion) return authError("Federation request is missing");

  try {
    verifyRebyteFederationAssertion(cookieAssertion, secret);
  } catch {
    return authError("Invalid or expired federation request");
  }

  return { props: {} };
};

const authError = (message: string) => ({
  redirect: {
    destination: `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/error?error=${encodeURIComponent(message)}`,
    permanent: false,
  },
});
