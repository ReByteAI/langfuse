/**
 * Authenticated layout variant
 * Full application layout with sidebar, navigation, and payment banner
 * Used for all main application pages when user is authenticated
 */

import { useEffect, type ComponentProps, type PropsWithChildren } from "react";
import Head from "next/head";
import { useRouter, type NextRouter } from "next/router";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/src/components/ui/sidebar";
import { AppSidebar } from "@/src/components/nav/AppSidebar/AppSidebar";
import { SidebarPresenceProvider } from "@/src/components/nav/sidebar-presence";
import { Toaster } from "@/src/components/ui/sonner";
import { Layer } from "@/src/components/ui/layer";
import { TopBannerProvider } from "@/src/features/top-banner";
import { AppContentWithRightDrawer } from "../right-drawer/AppContentWithRightDrawer";
import { ThemeToggle } from "@/src/features/theming/ThemeToggle";
import type { Session } from "next-auth";
import type { NavigationItem } from "@/src/components/layouts/utilities/routes";
import type { RouteGroup } from "@/src/components/layouts/routes";
import dynamic from "next/dynamic";
import { InAppAgentWindowHost } from "@/src/features/in-app-agent/components/InAppAgentWindowHost";
import { useSession } from "next-auth/react";
import { useQueryProjectOrOrganization } from "@/src/features/projects/hooks";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { REBYTE_APP_URL, REBYTE_BRAND_NAME } from "@/src/constants/rebyte";

const CommandMenu = dynamic(
  () =>
    import("@/src/features/command-k-menu/CommandMenu").then((mod) => ({
      default: mod.CommandMenu,
    })),
  {
    ssr: false,
  },
);

const PaymentBanner = dynamic(
  () =>
    import("@/src/features/payment-banner").then((mod) => ({
      default: mod.PaymentBanner,
    })),
  {
    ssr: false,
  },
);

const PreviewDeploymentBanner = dynamic(
  () =>
    import("@/src/features/preview-deployment-banner").then((mod) => ({
      default: mod.PreviewDeploymentBanner,
    })),
  {
    ssr: false,
  },
);

/** Grouped navigation structure returned by processNavigation */
type GroupedNavigation = {
  ungrouped: NavigationItem[];
  grouped: Partial<Record<RouteGroup, NavigationItem[]>> | null;
  flattened: NavigationItem[];
};

type AuthenticatedLayoutProps = PropsWithChildren<{
  session: Session;
  navigation: {
    mainNavigation: GroupedNavigation;
    secondaryNavigation: GroupedNavigation;
    navigation: NavigationItem[];
  };
  metadata: {
    title: string;
    faviconPath: string;
  };
  onSignOut: () => void;
}>;

/**
 * Full authenticated layout with all features:
 * - AppSidebar with navigation
 * - Payment banner (conditional)
 * - Command menu (Cmd/Ctrl+K)
 * - Toast notifications
 * - Dynamic page metadata
 */
export function AuthenticatedLayout({
  children,
  session,
  navigation,
  metadata,
  onSignOut,
}: AuthenticatedLayoutProps) {
  const router = useRouter();
  useProjectCookie(router);

  // Safe assertion: AuthenticatedLayout is only rendered after auth checks pass
  // in AppLayout, which guarantees session.user exists at this point
  const user = session.user;
  if (!user) {
    // This should never happen due to guards in AppLayout, but TypeScript needs this
    return null;
  }

  // User navigation items for sidebar dropdown
  const sidebarUser = {
    name: user.name ?? "",
    email: user.email ?? "",
    avatar: user.image ?? "",
  };
  const userMenuItems = [
    {
      type: "link" as const,
      name: `Back to ${REBYTE_BRAND_NAME}`,
      href: REBYTE_APP_URL,
    },
    {
      type: "action" as const,
      name: "Theme",
      onClick: () => {},
      content: <ThemeToggle />,
    },
    { type: "action" as const, name: "Sign out", onClick: onSignOut },
  ];

  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <link rel="icon" type="image/svg+xml" href={metadata.faviconPath} />
      </Head>

      <TopBannerProvider>
        <SidebarPresenceProvider>
          <SidebarProvider>
            <div className="flex h-dvh w-full flex-col">
              <PaymentBanner />
              <PreviewDeploymentBanner />
              <div className="pt-banner-offset flex min-h-0 flex-1">
                <ConnectedAppSidebar
                  navItems={navigation.mainNavigation}
                  secondaryNavItems={navigation.secondaryNavigation}
                  user={sidebarUser}
                  userMenuItems={userMenuItems}
                />
                {/* `min-w-0`, not a `100vw`-derived width: viewport units ignore
                    scrollbars, and a definite width also floors `min-width:
                    auto`, so on a wide page the inset stayed pinned 15px past
                    the space beside the sidebar once a space-taking vertical
                    scrollbar showed — spawning a horizontal one. Flex already
                    sizes the inset to that space. */}
                <SidebarInset className="h-screen-with-banner max-w-full min-w-0">
                  <AppContentWithRightDrawer>
                    {children}
                  </AppContentWithRightDrawer>
                  {/* Toasts render in the `toast` overlay layer — the last layer
                      in LAYER_ORDER — so they paint above every overlay (incl. a
                      non-modal peek) by DOM order alone, no z-index. Sonner's
                      Toaster is position:fixed, so nesting it in the fixed
                      full-screen layer container is positionally identical. */}
                  <Layer name="toast">
                    <Toaster visibleToasts={1} />
                  </Layer>
                  <CommandMenu mainNavigation={navigation.navigation} />
                  {/* Assistant window host lives here (not in PageHeader with
                      its launcher button) so the open window and its geometry
                      survive route changes. */}
                  <InAppAgentWindowHost />
                </SidebarInset>
              </div>
            </div>
          </SidebarProvider>
        </SidebarPresenceProvider>
      </TopBannerProvider>
    </>
  );
}

function ConnectedAppSidebar({
  navItems,
  secondaryNavItems,
  user,
  userMenuItems,
}: {
  navItems: GroupedNavigation;
  secondaryNavItems: GroupedNavigation;
  user: ComponentProps<typeof AppSidebar>["user"];
  userMenuItems: ComponentProps<typeof AppSidebar>["userMenuItems"];
}) {
  const { isMobile } = useSidebar();
  const session = useSession();
  const { organization, project } = useQueryProjectOrOrganization();
  const canCreateProjects = useHasOrganizationAccess({
    organizationId: organization?.id,
    scope: "projects:create",
  });
  return (
    <AppSidebar
      navItems={navItems}
      secondaryNavItems={secondaryNavItems}
      user={user}
      userMenuItems={userMenuItems}
      isMobile={isMobile}
      organization={
        organization ? { id: organization.id, name: organization.name } : null
      }
      project={project ? { id: project.id, name: project.name } : null}
      organizations={session.data?.user?.organizations ?? null}
      canCreateOrganizations={
        session.data?.user?.canCreateOrganizations ?? false
      }
      canCreateProjects={canCreateProjects}
    />
  );
}

/** useProjectCookie pings the visit beacon so the project sentinel can route the user back here. */
function useProjectCookie(router: NextRouter) {
  const projectId = router.query.projectId;
  useEffect(() => {
    if (typeof projectId !== "string") return;
    fetch(`/api/project/${encodeURIComponent(projectId)}/visit`, {
      method: "POST",
    }).catch(() => {});
  }, [projectId]);
}
