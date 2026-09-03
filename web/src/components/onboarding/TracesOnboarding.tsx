import { LangfuseIcon } from "@/src/components/design-system/LangfuseIcon/LangfuseIcon";
import { Button } from "@/src/components/ui/button";
import { REBYTE_APP_URL, REBYTE_PRODUCT_NAME } from "@/src/constants/rebyte";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function TracesOnboarding(_props: { projectId: string }) {
  return (
    <div className="flex min-h-[28rem] items-center justify-center px-6 py-12">
      <div className="bg-card w-full max-w-xl rounded-xl border px-8 py-12 text-center shadow-xs">
        <div className="bg-muted mx-auto mb-6 flex size-14 items-center justify-center rounded-xl border">
          <LangfuseIcon size={32} />
        </div>
        <p className="text-muted-foreground mb-3 text-xs tracking-[0.18em] uppercase">
          {REBYTE_PRODUCT_NAME}
        </p>
        <h2 className="mb-3 text-2xl font-bold tracking-tight">
          Agent traces will appear here
        </h2>
        <p className="text-muted-foreground mx-auto mb-7 max-w-md text-sm leading-6">
          Run any agent in Rebyte. Its steps, model calls, tool activity, and
          timing will arrive here automatically.
        </p>
        <Button asChild>
          <Link href={REBYTE_APP_URL}>
            Open Rebyte
            <ArrowUpRight className="ml-1 size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
