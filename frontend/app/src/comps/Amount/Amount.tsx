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
  if (!value) {
    return null;
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
