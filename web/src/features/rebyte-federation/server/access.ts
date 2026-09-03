import crypto from "node:crypto";

import { prisma } from "@langfuse/shared/src/db";

import type { RebyteFederationClaims } from "./assertion";

const deterministicId = (prefix: string, accountId: string) =>
  `${prefix}-${crypto
    .createHash("sha256")
    .update(`rebyte-federation:v1:${accountId}`, "utf8")
    .digest("hex")
    .slice(0, 32)}`;

export const getRebyteFederationIds = (accountId: string) => ({
  organizationId: deterministicId("rebyte-org", accountId),
  projectId: deterministicId("rebyte-project", accountId),
});

export const ensureRebyteOrganizationProject = async ({
  accountId,
  organizationName,
}: {
  accountId: string;
  organizationName?: string;
}) => {
  const { organizationId, projectId } = getRebyteFederationIds(accountId);

  await prisma.$transaction(async (tx) => {
    const existingProject = await tx.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    if (existingProject && existingProject.orgId !== organizationId) {
      throw new Error("Rebyte project tenant binding conflict");
    }

    await tx.organization.upsert({
      where: { id: organizationId },
      update: organizationName ? { name: organizationName } : {},
      create: {
        id: organizationId,
        name: organizationName ?? "Rebyte organization",
        metadata: { source: "rebyte", accountId },
      },
    });

    await tx.project.upsert({
      where: { id: projectId },
      update: { name: "Agents", deletedAt: null },
      create: {
        id: projectId,
        orgId: organizationId,
        name: "Agents",
        metadata: { source: "rebyte", accountId },
      },
    });
  });

  return { organizationId, projectId };
};

export const ensureRebyteOrganizationAccess = async ({
  claims,
  langfuseUserId,
}: {
  claims: RebyteFederationClaims;
  langfuseUserId: string;
}) => {
  const linkedAccount = await prisma.account.findFirst({
    where: {
      provider: "custom",
      providerAccountId: claims.clerkUserId,
      userId: langfuseUserId,
    },
    select: { id: true },
  });

  if (!linkedAccount) {
    throw new Error("Rebyte identity does not match the Langfuse session");
  }

  const { organizationId, projectId } = await ensureRebyteOrganizationProject({
    accountId: claims.accountId,
    organizationName: claims.organizationName,
  });

  await prisma.$transaction(async (tx) => {
    await tx.organizationMembership.upsert({
      where: {
        orgId_userId: {
          orgId: organizationId,
          userId: langfuseUserId,
        },
      },
      update: { role: "MEMBER" },
      create: {
        orgId: organizationId,
        userId: langfuseUserId,
        role: "MEMBER",
      },
    });
  });

  return { organizationId, projectId };
};
