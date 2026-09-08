import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEmbedParentOrigin,
  isObservabilityEmbedRoute,
  postObservabilityStatus,
  withObservabilityEmbedParams,
} from "./embed";

const parentOrigin = "https://app.rebyte.ai";
const query = {
  embed: "1",
  parentOrigin,
  projectId: "project-1",
  filter: "metadata;stringObject;workspaceId;=;agent-1",
  dateRange: "All",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Rebyte observability embed boundary", () => {
  it("requires an exact configured parent and an explicit embed flag", () => {
    expect(getEmbedParentOrigin(query, parentOrigin)).toBe(parentOrigin);
    for (const value of [
      "https://app.rebyte.ai.evil.test",
      "https://app.rebyte.ai/",
      "*",
      "null",
    ]) {
      expect(
        getEmbedParentOrigin({ ...query, parentOrigin: value }, parentOrigin),
      ).toBeUndefined();
    }
    expect(
      getEmbedParentOrigin({ ...query, embed: "0" }, parentOrigin),
    ).toBeUndefined();
    expect(getEmbedParentOrigin(query, "")).toBeUndefined();
    expect(
      getEmbedParentOrigin(
        { ...query, parentOrigin: [parentOrigin] },
        parentOrigin,
      ),
    ).toBeUndefined();
    expect(isObservabilityEmbedRoute("/project/[projectId]/settings")).toBe(
      false,
    );
    expect(
      isObservabilityEmbedRoute("/project/[projectId]/traces/[traceId]"),
    ).toBe(true);
  });

  it("retains frame context and list filters only within the same project's traces", () => {
    vi.stubEnv("NEXT_PUBLIC_REBYTE_EMBED_ALLOWED_ORIGINS", parentOrigin);
    const result = new URL(
      withObservabilityEmbedParams(
        "/project/project-1/traces/trace-1?observation=span-1",
        query,
      ),
      parentOrigin,
    );
    expect(result.searchParams.get("embed")).toBe("1");
    expect(result.searchParams.get("parentOrigin")).toBe(parentOrigin);
    expect(result.searchParams.get("filter")).toBe(query.filter);
    expect(result.searchParams.get("dateRange")).toBe("All");
    expect(result.searchParams.get("observation")).toBe("span-1");
    for (const path of [
      "/project/other/traces",
      "/project/project-1/settings",
      "https://elsewhere.test",
    ]) {
      expect(withObservabilityEmbedParams(path, query)).toBe(path);
    }
  });

  it("sends status without content only to the configured parent, including base paths", () => {
    vi.stubEnv("NEXT_PUBLIC_REBYTE_EMBED_ALLOWED_ORIGINS", parentOrigin);
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/lf");
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      parent: { postMessage },
      location: {
        pathname: "/lf/project/project-1/traces/trace-1",
        search: `?embed=1&parentOrigin=${encodeURIComponent(parentOrigin)}`,
      },
    });
    for (const status of [
      "ready",
      "auth-required",
      "forbidden",
      "error",
    ] as const) {
      postObservabilityStatus(status);
      expect(postMessage).toHaveBeenLastCalledWith(
        { type: "rebyte:observability", status, projectId: "project-1" },
        parentOrigin,
      );
    }
    window.location.search = "?embed=1&parentOrigin=https://evil.test";
    postObservabilityStatus("ready");
    expect(postMessage).toHaveBeenCalledTimes(4);
  });
});
