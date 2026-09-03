import type { GetServerSideProps } from "next";

import { env } from "@/src/env.mjs";
import { verifyRebyteFederationAssertion } from "@/src/features/rebyte-federation/server/assertion";
import { ensureRebyteOrganizationAccess } from "@/src/features/rebyte-federation/server/access";
import {
  clearRebyteFederationCookie,
  readRebyteFederationCookie,
} from "@/src/features/rebyte-federation/server/cookie";
import { getServerAuthSession } from "@/src/server/auth";

export default function CompleteRebyteFederationLogin() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const fail = () => {
    res.setHeader("Set-Cookie", clearRebyteFederationCookie());
    return authError("Federation sign-in could not be completed");
  };

  const secret = env.REBYTE_FEDERATION_SECRET;
  const assertion = readRebyteFederationCookie(req.cookies);
  if (!secret || !assertion) return fail();

  try {
    const claims = verifyRebyteFederationAssertion(assertion, secret);
    const session = await getServerAuthSession({ req, res });
    if (!session?.user?.id) return fail();

    const { projectId } = await ensureRebyteOrganizationAccess({
      claims,
      langfuseUserId: session.user.id,
    });

    res.setHeader("Set-Cookie", clearRebyteFederationCookie());
    return {
      redirect: {
        destination: `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/project/${projectId}/traces`,
        permanent: false,
      },
    };
  } catch {
    return fail();
  }
};

const authError = (message: string) => ({
  redirect: {
    destination: `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/error?error=${encodeURIComponent(message)}`,
    permanent: false,
  },
});
