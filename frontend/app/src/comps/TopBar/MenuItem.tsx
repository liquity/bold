import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import Image from "next/image";
import { MenuItemType } from "./Menu";

const getSnailIcon = ({ icon, type }: { icon: ReactNode, type?: MenuItemType }) => {
  switch (type) {
    case "dashboard":
      return <Image src='/cute-snails/brown.png' alt='Dashboard' width={24} height={24} />;
    case "borrow":
      return <Image src='/cute-snails/battle.png' alt='Borrow' width={24} height={24} />;
    case "multiply":
      return <Image src='/cute-snails/green.png' alt='Leverage' width={24} height={24} />;
    case "earn":
      return <Image src='/cute-snails/blue.png' alt='Earn' width={24} height={24} />;
    case "buy":
      return <Image src='/cute-snails/gold.png' alt='Buy' width={24} height={24} />;
    case "stream":
      return <Image src='/cute-snails/green.png' alt='Stream' width={24} height={24} />;
    case "ecosystem":
      return <Image src='/cute-snails/red.png' alt='Ecosystem' width={24} height={24} />;
    // case "stake":
    //   return <Image src='/cute-snails/red.png' alt='Stake' width={24} height={24} />;
    default:
      return icon;
  }
};

export function MenuItem({
  icon,
  label,
  selected,
  type,
}: {
  icon: ReactNode;
  label: string;
  selected?: boolean;
  type?: MenuItemType;
}) {
  return (
    <div
      aria-selected={selected}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: "100%",
        color: "content",
        cursor: "pointer",
        userSelect: "none",
      })}
      style={{
        color: token(`colors.${selected ? "selected" : "interactive"}`),
      }}
    >
      <div
        className={css({
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
        })}
      >
        {/* {icon} */}
        {getSnailIcon({ icon, type })}
      </div>
      {label}
    </div>
  );
}
