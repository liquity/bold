import { fmtnum } from "@/src/formatting";

export function Amount({
  fallback,
  format,
  percentage = false,
  prefix = "",
  suffix = "",
  value,
}: {
  fallback?: string;
  format?: Parameters<typeof fmtnum>[1];
  percentage?: boolean;
  prefix?: string;
  suffix?: string;
  value: Parameters<typeof fmtnum>[0];
}) {
  if (!value) {
    return fallback ?? null;
  }
  if (percentage && !suffix) {
    suffix = "%";
  }
  const titleValue = format === "full" ? null : fmtnum(value, "full", percentage ? 100 : 1);
  const contentValue = fmtnum(value, format, percentage ? 100 : 1);
  const contentFull = prefix + contentValue + suffix;
  return contentValue === titleValue || !titleValue ? contentFull : (
    <span title={`${prefix}${titleValue}${suffix}`}>
      {contentFull}
    </span>
  );
}
