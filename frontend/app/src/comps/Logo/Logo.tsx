import Image from "next/image";
import icLogo from "./ic-logo-defi-dollar.svg";

export function Logo({ size = 32 }: { size?: number }) {
  return <Image alt="Logo" src={icLogo} width={size} height={size} />;
}
