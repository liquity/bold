import { fmtnum } from "@/src/formatting";

export function Amount({
  value,
  format,
  percentage = false,
}: {
  value: Parameters<typeof fmtnum>[0];
  format?: Parameters<typeof fmtnum>[1];
  percentage?: boolean;
}) {
  return value && (
    <span title={fmtnum(value, "full", percentage ? 100 : 1)}>
      {fmtnum(
        value,
        format,
        percentage ? 100 : 1,
      )}
      {percentage ? "%" : ""}
    </span>
  );
}
