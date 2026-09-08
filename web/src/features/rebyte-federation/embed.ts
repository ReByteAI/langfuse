type Query = Record<string, string | string[] | undefined>;

export type ObservabilityStatus =
  | "ready"
  | "auth-required"
  | "forbidden"
  | "error";

/** The public value is compiled from the exact same allowlist as frame-ancestors. */
export function getEmbedParentOrigin(
  query: Query,
  allowedOrigins = process.env.NEXT_PUBLIC_REBYTE_EMBED_ALLOWED_ORIGINS ?? "",
): string | undefined {
  if (query.embed !== "1" || typeof query.parentOrigin !== "string") return;
  try {
    const origin = new URL(query.parentOrigin);
    if (
      origin.origin !== query.parentOrigin ||
      !["https:", "http:"].includes(origin.protocol)
    )
      return;
  } catch {
    return;
  }
  return allowedOrigins.split(",").includes(query.parentOrigin)
    ? query.parentOrigin
    : undefined;
}

export function isObservabilityEmbedRoute(pathname: string): boolean {
  return (
    pathname === "/project/[projectId]/traces" ||
    pathname === "/project/[projectId]/traces/[traceId]"
  );
}

/** Keep the parent bridge and list scope across trace/peek navigation only. */
export function withObservabilityEmbedParams(
  path: string,
  query: Query = {},
): string {
  if (!getEmbedParentOrigin(query) || !path.startsWith("/project/"))
    return path;
  const url = new URL(path, "https://embed.invalid");
  const match = /^\/project\/([^/]+)\/traces(?:\/[^/]+)?$/.exec(url.pathname);
  if (!match || match[1] !== query.projectId) return path;
  for (const key of ["embed", "parentOrigin", "filter", "dateRange"]) {
    const value = query[key];
    if (typeof value === "string" && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** No credentials or trace content cross the frame boundary. */
export function postObservabilityStatus(status: ObservabilityStatus): void {
  if (typeof window === "undefined" || window.parent === window) return;
  const query = Object.fromEntries(new URLSearchParams(window.location.search));
  const parentOrigin = getEmbedParentOrigin(query);
  const path = window.location.pathname.slice(
    (process.env.NEXT_PUBLIC_BASE_PATH ?? "").length,
  );
  const match = /^\/project\/([^/]+)\/traces(?:\/[^/]+)?$/.exec(path);
  if (!parentOrigin || !match) return;
  window.parent.postMessage(
    {
      type: "rebyte:observability",
      status,
      projectId: decodeURIComponent(match[1]),
    },
    parentOrigin,
  );
}
