import { getCookieName, getCookieOptions } from "@/src/server/utils/cookies";

const COOKIE_MAX_AGE_SECONDS = 120;

const getRebyteFederationCookieName = () => getCookieName("rebyte.launch");

const serializeCookie = (value: string, maxAge: number): string => {
  const options = getCookieOptions();
  const parts = [
    `${getRebyteFederationCookieName()}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    "HttpOnly",
  ];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
};

export const serializeRebyteFederationCookie = (assertion: string) =>
  serializeCookie(assertion, COOKIE_MAX_AGE_SECONDS);

export const clearRebyteFederationCookie = () => serializeCookie("", 0);

export const readRebyteFederationCookie = (
  cookies: Partial<Record<string, string>>,
) => cookies[getRebyteFederationCookieName()] ?? null;
