import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { env } from "@/src/env.mjs";
import { getRebyteFederationIds } from "@/src/features/rebyte-federation/server/access";
import { verifyRebyteRevocationAssertion } from "@/src/features/rebyte-federation/server/revocation";
import { prisma } from "@langfuse/shared/src/db";
import { logger, redis } from "@langfuse/shared/src/server";

const bodySchema = z.object({ assertion: z.string().max(4_096) }).strict();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const secret = env.REBYTE_FEDERATION_SECRET;
    if (!secret || !redis) throw new Error("Federation is unavailable");
    const { assertion } = bodySchema.parse(req.body);
    const claims = verifyRebyteRevocationAssertion(assertion, secret);
    const ttlSeconds = Math.max(
      1,
      claims.expiresAt - Math.floor(Date.now() / 1_000) + 10,
    );
    const consumed = await redis.set(
      `rebyte-federation:revocation:${claims.nonce}`,
      "1",
      "EX",
      ttlSeconds,
      "NX",
    );
    if (consumed !== "OK") return res.status(204).end();

    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "custom",
          providerAccountId: claims.clerkUserId,
        },
      },
      select: { userId: true },
    });
    if (account) {
      const { organizationId } = getRebyteFederationIds(claims.accountId);
      await prisma.organizationMembership.deleteMany({
        where: { orgId: organizationId, userId: account.userId },
      });
    }

    return res.status(204).end();
  } catch (error) {
    logger.warn("Rejected Rebyte federation revocation", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return res.status(401).json({ message: "Unauthorized" });
  }
}
