/**
 * Hook to generate layout metadata (page titles, favicons, etc.)
 * Based on active navigation and the Rebyte product brand
 */

import { useMemo } from "react";
import { env } from "@/src/env.mjs";
import type { NavigationItem } from "@/src/components/layouts/utilities/routes";
import { REBYTE_PRODUCT_NAME } from "@/src/constants/rebyte";

/**
 * Generates metadata for the layout including:
 * - Dynamic page title based on active route
 * - Product favicon
 *
 * @param activePathName - Title of the currently active navigation item
 * @param navigation - Full navigation array for finding active item
 * @returns Metadata object with title and icon paths
 */
export function useLayoutMetadata(
  activePathName: string | undefined,
  _navigation: NavigationItem[],
) {
  return useMemo(() => {
    const basePath = env.NEXT_PUBLIC_BASE_PATH ?? "";

    // Determine page title from active route
    const title = activePathName
      ? `${activePathName} | ${REBYTE_PRODUCT_NAME}`
      : REBYTE_PRODUCT_NAME;

    return {
      title,
      faviconPath: `${basePath}/icon.svg`,
    };
  }, [activePathName]);
}
