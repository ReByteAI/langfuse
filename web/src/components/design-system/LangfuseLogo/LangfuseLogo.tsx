import { LangfuseIcon } from "@/src/components/design-system/LangfuseIcon/LangfuseIcon";
import { cn } from "@/src/utils/tailwind";
import { REBYTE_BRAND_NAME } from "@/src/constants/rebyte";

export const LangfuseLogo = ({
  logoLightModeHref,
  logoDarkModeHref,
}: {
  logoLightModeHref?: string;
  logoDarkModeHref?: string;
}) => {
  if (logoLightModeHref && logoDarkModeHref) {
    // logo is a url, maximum aspect ratio of 1:3 needs to be supported according to docs
    return (
      <div className="flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoLightModeHref}
          alt="Custom logo"
          className={cn(
            "group-data-[collapsible=icon]:hidden dark:hidden",
            "max-h-4 max-w-14",
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoDarkModeHref}
          alt="Custom logo"
          className={cn(
            "hidden group-data-[collapsible=icon]:hidden dark:block",
            "max-h-4 max-w-14",
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="group-data-[collapsible=icon]:hidden">
        <LangfuseIcon size={16} />
      </div>
      <span className="text-[15px] tracking-[-0.01em] whitespace-nowrap group-data-[collapsible=icon]:hidden">
        {REBYTE_BRAND_NAME}
      </span>
      <div className="hidden group-data-[collapsible=icon]:block">
        <LangfuseIcon size={28} />
      </div>
    </div>
  );
};
