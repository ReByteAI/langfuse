/* eslint-disable @repo/no-style-props, @repo/no-null-render */
import { cn } from "@/src/utils/tailwind";
import Link from "next/link";
import { useUiCustomization } from "@/src/ee/features/ui-customization/useUiCustomization";
import { LangfuseIcon } from "@/src/components/design-system/LangfuseIcon/LangfuseIcon";
import { useHasAppSidebar } from "@/src/components/nav/sidebar-presence";
import { REBYTE_BRAND_NAME } from "@/src/constants/rebyte";

/**
 * Compact Rebyte brand mark for the top bar.
 *
 * The primary brand lives in the sidebar header. The page header renders this
 * compact mark when the sidebar moves off-canvas.
 *
 * `variant="icon"` (default) renders just the Rebyte mark; `variant="wordmark"`
 * renders the full logotype, for the centered brand in the mobile top bar.
 *
 * Respects the self-host UI-customization logo entitlement and links to `/`.
 */
export const TopbarBrand = ({
  className,
  variant = "icon",
}: {
  className?: string;
  variant?: "icon" | "wordmark";
}) => {
  const hasAppSidebar = useHasAppSidebar();
  const uiCustomization = useUiCustomization();
  const logoLight = uiCustomization?.logoLightModeHref;
  const logoDark = uiCustomization?.logoDarkModeHref;

  // Only brand where a real sidebar exists to mirror. On the sidebar-less
  // MinimalLayout (public/shared trace & session views) supplies its own
  // leading control, so an extra brand mark here would be redundant.
  if (!hasAppSidebar) return null;

  return (
    <Link
      href="/"
      aria-label={`${REBYTE_BRAND_NAME} home`}
      className={cn("flex shrink-0 items-center gap-1", className)}
    >
      {logoLight && logoDark ? (
        // Custom logo (max aspect ratio 1:3 per docs).
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoLight}
            alt="Logo"
            className="max-h-5 max-w-16 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDark}
            alt="Logo"
            className="hidden max-h-5 max-w-16 dark:block"
          />
        </>
      ) : variant === "wordmark" ? (
        <>
          <LangfuseIcon size={16} />
          <span className="text-[15px] tracking-[-0.01em]">
            {REBYTE_BRAND_NAME}
          </span>
        </>
      ) : (
        <LangfuseIcon size={28} />
      )}
    </Link>
  );
};
