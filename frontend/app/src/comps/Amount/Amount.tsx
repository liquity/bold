import { fmtnum } from "@/src/formatting";

export function Amount({
  value,
  format,
  percentage = false,
  suffix = "",
}: {
  value: Parameters<typeof fmtnum>[0];
  format?: Parameters<typeof fmtnum>[1];
  percentage?: boolean;
  suffix?: string;
}) {
  if (percentage && !suffix) {
    suffix = "%";
  }
  return value && (
    <span
      title={format === "full" ? undefined : `${
        fmtnum(
          value,
          "full",
          percentage ? 100 : 1,
        )
      }${suffix}`}
    >
      {fmtnum(
        value,
        format,
        percentage ? 100 : 1,
      )}
      {suffix}
    </span>
  );
}
