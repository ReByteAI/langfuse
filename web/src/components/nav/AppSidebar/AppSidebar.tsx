"use client";

import * as React from "react";
import { NavMain, type NavMainItem } from "@/src/components/nav/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/src/components/ui/sidebar";
import Link from "next/link";
import { LangfuseLogo } from "@/src/components/design-system/LangfuseLogo/LangfuseLogo";
import { type RouteGroup } from "@/src/components/layouts/routes";
import { ChevronsUpDown, ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Avatar } from "@/src/components/design-system/Avatar/Avatar";
import { OrganizationDropdownMenu } from "@/src/components/OrganizationDropdownMenu/OrganizationDropdownMenu";
import { ProjectDropdownMenu } from "@/src/components/ProjectDropdownMenu/ProjectDropdownMenu";
import { assertUnreachable } from "@/src/utils/types";
import { useOrgProjectSwitchPaths } from "@/src/features/projects/hooks";
import {
  APP_SHELL_CHROME_ROW_CLASS,
  APP_SHELL_CHROME_ROW_TEST_ID,
} from "@/src/components/layouts/app-shell-chrome";
import { cn } from "@/src/utils/tailwind";

type UserNavigationItemBase = {
  name: string;
  content?: React.ReactNode;
};

type UserNavigationLeafItem =
  | (UserNavigationItemBase & {
      type: "action";
      onClick: () => void;
    })
  | (UserNavigationItemBase & {
      type: "link";
      href: string;
    });

type UserNavigationItem =
  | UserNavigationLeafItem
  | (UserNavigationItemBase & {
      type: "submenu";
      subItems: UserNavigationLeafItem[];
    });

type SidebarUser = {
  name: string;
  email: string;
  avatar: string;
};

type OrganizationDropdownOption = Extract<
  React.ComponentProps<typeof OrganizationDropdownMenu>,
  { state: "loaded" }
>["organizations"][number];

type ProjectOption = Extract<
  React.ComponentProps<typeof ProjectDropdownMenu>,
  { state: "loaded" }
>["projects"][number];

type OrganizationOption = OrganizationDropdownOption & {
  projects: ProjectOption[];
};

type AppSidebarProps = {
  navItems: {
    grouped: Partial<Record<RouteGroup, NavMainItem[]>> | null;
    ungrouped: NavMainItem[];
  };
  secondaryNavItems: {
    grouped: Partial<Record<RouteGroup, NavMainItem[]>> | null;
    ungrouped: NavMainItem[];
  };
  user: SidebarUser;
  userMenuItems: UserNavigationItem[];
  isMobile: boolean;
  organization: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  organizations: OrganizationOption[] | null;
  canCreateOrganizations: boolean;
  canCreateProjects: boolean;
};

export function AppSidebar({
  navItems,
  secondaryNavItems,
  user,
  userMenuItems,
  isMobile,
  organization,
  project,
  organizations,
  canCreateOrganizations,
  canCreateProjects,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div
          data-testid={APP_SHELL_CHROME_ROW_TEST_ID}
          className={cn(
            APP_SHELL_CHROME_ROW_CLASS,
            "min-w-0 gap-2 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
          )}
        >
          <Link href="/" className="flex items-center" aria-label="Rebyte home">
            <LangfuseLogo />
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isMobile && organization && (
          <MobileNavSwitcher
            organization={organization}
            project={project}
            organizations={organizations}
            canCreateOrganizations={canCreateOrganizations}
            canCreateProjects={canCreateProjects}
          />
        )}
        <NavMain items={navItems} />
        <div className="flex-1" />
        <NavMain items={secondaryNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} items={userMenuItems} isMobile={isMobile} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function MobileNavSwitcher({
  organization,
  project,
  organizations,
  canCreateOrganizations,
  canCreateProjects,
}: {
  organization: { id: string; name: string };
  project: { id: string; name: string } | null;
  organizations: OrganizationOption[] | null;
  canCreateOrganizations: boolean;
  canCreateProjects: boolean;
}) {
  const { getProjectPath, getOrgPath } = useOrgProjectSwitchPaths();

  return (
    <SidebarGroup className="border-b">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <span
                    className="min-w-0 flex-1 truncate text-left"
                    title={organization.name}
                  >
                    {organization.name}
                  </span>
                  <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <OrganizationDropdownMenu
                {...(organizations
                  ? { state: "loaded", organizations }
                  : { state: "loading" })}
                canCreateOrganizations={canCreateOrganizations}
                getOrgPath={getOrgPath}
              />
            </DropdownMenu>
          </SidebarMenuItem>
          {project && (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <span
                      className="min-w-0 flex-1 truncate text-left"
                      title={project.name}
                    >
                      {project.name}
                    </span>
                    <ChevronDownIcon className="ml-auto h-4 w-4 shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <ProjectDropdownMenu
                  organizationId={organization.id}
                  {...(organizations
                    ? {
                        state: "loaded",
                        projects:
                          organizations.find(
                            (item) => item.id === organization.id,
                          )?.projects ?? [],
                      }
                    : { state: "loading" })}
                  canCreateProjects={canCreateProjects}
                  getProjectPath={getProjectPath}
                />
              </DropdownMenu>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavUser({
  user,
  items,
  isMobile,
}: {
  user: SidebarUser;
  items: UserNavigationItem[];
  isMobile: boolean;
}) {
  const renderMenuItem = (item: UserNavigationItem) => {
    if (item.type === "submenu") {
      return (
        <DropdownMenuSub key={item.name}>
          <DropdownMenuSubTrigger>
            {item.content ?? item.name}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {item.subItems.map(renderMenuItem)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }

    if (item.type === "link") {
      return (
        <DropdownMenuItem key={item.name} asChild>
          <Link href={item.href}>{item.content ?? item.name}</Link>
        </DropdownMenuItem>
      );
    }

    if (item.type === "action") {
      return (
        <DropdownMenuItem key={item.name} onClick={item.onClick}>
          {item.content ?? item.name}
        </DropdownMenuItem>
      );
    }

    return assertUnreachable(item);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar
                size="lg"
                shape="rounded"
                src={user.avatar}
                displayName={user.name}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold" title={user.name}>
                  {user.name}
                </span>
                <span className="truncate text-xs" title={user.email}>
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar
                  size="lg"
                  shape="rounded"
                  src={user.avatar}
                  displayName={user.name}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold" title={user.name}>
                    {user.name}
                  </span>
                  <span className="truncate text-xs" title={user.email}>
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>{items.map(renderMenuItem)}</DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
