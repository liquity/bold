import icLogo from "./ic-logo-spice-usd.svg";
import Image from "next/image";

export function Logo({
  size = 32,
}: {
  size?: number;
}) {
  return (
    <div>
      <Image
        alt="SpiceUSD logo"
        src={icLogo}
        width={size}
        height={size}
      />
    </div>
  );
}
