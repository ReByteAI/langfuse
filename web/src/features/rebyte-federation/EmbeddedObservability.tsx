import { useEffect, type PropsWithChildren, type MouseEvent } from "react";
import { useRouter } from "next/router";
import { SidebarProvider } from "@/src/components/ui/sidebar";
import { Layer } from "@/src/components/ui/layer";
import { Toaster } from "@/src/components/ui/sonner";
import { PageHeaderControlsSlotTarget } from "@/src/components/layouts/page-header-controls-slot";
import type { PageHeaderProps } from "@/src/components/layouts/page-header";
import {
  postObservabilityStatus,
  withObservabilityEmbedParams,
  type ObservabilityStatus,
} from "./embed";

export function EmbeddedObservability({
  children,
  status,
}: PropsWithChildren<{ status?: ObservabilityStatus }>) {
  const router = useRouter();
  const navigate = (event: MouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (!anchor || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    event.stopPropagation();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const path = `${url.pathname.slice(basePath.length)}${url.search}${url.hash}`;
    const embeddedPath = withObservabilityEmbedParams(path, router.query);
    const destination = new URL(embeddedPath, url.origin);
    const staysEmbedded =
      /^\/project\/[^/]+\/traces(?:\/[^/]+)?$/.test(destination.pathname) &&
      destination.pathname.split("/")[2] === router.query.projectId &&
      destination.searchParams.get("embed") === "1";
    if (
      !staysEmbedded ||
      anchor.target === "_blank" ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      window.open(
        staysEmbedded ? `${basePath}${embeddedPath}` : url.href,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      router.push(embeddedPath);
    }
  };
  useObservabilityDataStatus(status);
  return (
    <SidebarProvider>
      <main
        className="bg-background flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden"
        onClickCapture={navigate}
      >
        {status === "auth-required" ? (
          <p className="p-4" role="status">
            Connect Observability from Rebyte to continue.
          </p>
        ) : status === "forbidden" ? (
          <p className="p-4" role="alert">
            You do not have access to this project.
          </p>
        ) : (
          children
        )}
        <Layer name="toast">
          <Toaster visibleToasts={1} />
        </Layer>
      </main>
    </SidebarProvider>
  );
}

export function useObservabilityDataStatus(status?: ObservabilityStatus) {
  const router = useRouter();
  // External system: notify the exact allowed parent when frame/session state changes.
  useEffect(() => {
    if (status) postObservabilityStatus(status);
  }, [status, router.asPath]);
}

/** Keep analysis controls while removing the application navigation. */
export function EmbeddedObservabilityHeader({
  title,
  titleContent,
  actionButtonsRight,
}: PageHeaderProps) {
  return (
    <div className="bg-background flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
      <div className="min-w-0 truncate text-sm" title={title}>
        {titleContent ?? title}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PageHeaderControlsSlotTarget />
        {actionButtonsRight}
      </div>
    </div>
  );
}
