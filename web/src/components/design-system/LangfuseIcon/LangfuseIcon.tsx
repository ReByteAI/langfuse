import { env } from "@/src/env.mjs";
import { REBYTE_BRAND_NAME } from "@/src/constants/rebyte";

type LangfuseIconProps = {
  size?: 14 | 16 | 28 | 32 | 42;
};

export const LangfuseIcon = ({ size = 32 }: LangfuseIconProps) => (
  <span
    className="relative inline-flex shrink-0"
    style={{ width: size, height: size }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`}
      width={size}
      height={size}
      alt={REBYTE_BRAND_NAME}
      className="dark:hidden"
    />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/rebyte-icon-white.svg`}
      width={size}
      height={size}
      alt=""
      className="absolute inset-0 hidden dark:block"
    />
  </span>
);
