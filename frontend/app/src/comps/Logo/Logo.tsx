import { LQTY } from "@liquity2/uikit";

export function Logo({
  size = 32,
}: {
  size?: number;
}) {
  return (
    <img src={LQTY.icon} alt="" width={size} height={size} />
  );
}
