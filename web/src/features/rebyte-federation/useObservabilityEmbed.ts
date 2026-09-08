import { useRouter } from "next/router";
import { getEmbedParentOrigin, isObservabilityEmbedRoute } from "./embed";

export function useObservabilityEmbed(): boolean {
  const router = useRouter();
  return (
    router.isReady &&
    isObservabilityEmbedRoute(router.pathname) &&
    !!getEmbedParentOrigin(router.query)
  );
}
