import Image from "next/image";
import logoSvg from "@/src/assets/logo.svg";

export function Logo({
  size = 32,
}: {
  size?: number;
}) {
  return (
    <Image
      src={logoSvg}
      alt="Logo"
      width={size}
      height={size}
    />
  );
}
