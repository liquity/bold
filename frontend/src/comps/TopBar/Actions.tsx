import { css } from "@/styled-system/css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountButton } from "./AccountButton";
import { IconStats } from "./icons";
import { MenuItem } from "./MenuItem";

export function Actions() {
  const pathname = usePathname();
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
      })}
    >
      <Link href="/stats">
        <MenuItem
          icon={<IconStats />}
          selected={pathname.startsWith("/stats")}
          label="Stats"
        />
      </Link>
      <AccountButton />
    </div>
  );
}
