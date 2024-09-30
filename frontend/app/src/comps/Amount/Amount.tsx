import { fmtnum } from "@/src/formatting";

export function Amount({
  value,
  format,
  percentage = false,
  prefix = "",
  suffix = "",
}: {
  value: Parameters<typeof fmtnum>[0];
  format?: Parameters<typeof fmtnum>[1];
  percentage?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  if (percentage && !suffix) {
    suffix = "%";
  }
  return value && (
    <span
      title={format === "full" ? undefined : (
        `${prefix}${fmtnum(value, "full", percentage ? 100 : 1)}${suffix}`
      )}
    >
      {prefix}
      {fmtnum(
        value,
        format,
        percentage ? 100 : 1,
      )}
      {suffix}
    </span>
  );
}
