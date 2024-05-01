import { css } from "@/styled-system/css";
import { IconArrowBack } from "@liquity2/uikit";
import Link from "next/link";
import { POOLS } from "../pools";
import { Pool } from "./Pool";

export async function generateStaticParams() {
  return POOLS.map((pool) => ({
    pool: pool.symbol.toLowerCase(),
  }));
}

export default function EarnPool({ params }: { params: { pool: string } }) {
  const pool = POOLS.find((pool) => pool.symbol.toLowerCase() === params.pool);
  return pool && (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 48,
        width: 534,
      })}
    >
      <BackToPools />
      <Pool pool={pool} />
    </div>
  );
}

function BackToPools() {
  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
      })}
    >
      <Link href="/earn" passHref legacyBehavior>
        <a
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "accent",
            _active: {
              translate: "0 1px",
            },
          })}
        >
          <IconArrowBack />
          See all pools
        </a>
      </Link>
    </div>
  );
}
