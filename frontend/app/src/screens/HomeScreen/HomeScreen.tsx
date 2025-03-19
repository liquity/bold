"use client";

import { Positions } from "@/src/comps/Positions/Positions";
import {
  getBranches,
} from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";


export function HomeScreen() {
  const account = useAccount();
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: 64,
        width: "100%",
      })}
    >
      <Positions address={account.address ?? null} showNewPositionCard={false} />
      <div>
        <h1
          className={css({
            fontSize: 32,
            color: "content",
            userSelect: "none",
          })}
          style={{
            paddingBottom: 32,
          }}
        >
          My Token
        </h1>
        <div
          className={css({
            display: "grid",
            gap: 24,
          })}
          style={{
            gridTemplateColumns: `repeat(3, 1fr)`,
            gridAutoRows: 180,
          }}
        >
          <TokenCard
            token="bvUSD"
            link={{ label: "Buy", href: "#" }}
            subValues={[
              { label: "Value", value: "$10" },
              { label: "Locked", value: "$10" },
            ]}
          />
          <TokenCard
            token="sbvUSD"
            link={{ label: "Earn", href: "#" }}
            subValues={[
              { label: "Value", value: "$10" },
              { label: "Apy", value: "10%" },
            ]}
          />
          <TokenCard
            token="VCRAFT"
            link={{ label: "Buy", href: "#" }}
            subValues={[
              { label: "Value", value: "$10" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function TokenCard({
  token,
  link,
  subValues
}: {
  token: string,
  link: { label: string, href: string },
  subValues: { label: string, value: string }[]
}) {
  return (
    <div className={css({
      background: "token(colors.controlSurfaceAlt)",
      border: "1px solid token(colors.neutral100)",
      borderRadius: 8,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    })}>
      <div className={css({
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
      })}>
        <h1
          className={css({
            fontSize: 24,
            color: "content",
          })}>
          {token}
        </h1>
        <a href={link.href}
          className={css({
            color: "accent",
            textDecoration: "none",
          })}>
          {link.label}
        </a>
      </div>
      <div className={css({
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between"
      })}>
        {subValues.map((subValue) => (
          <SubValue key={subValue.label} label={subValue.label} value={subValue.value} />
        ))}
      </div>
    </div>
  )
}

function SubValue({ label, value }: { label: string, value: string }) {
  return (
    <div
      className={css({
        lineHeight: 1.2,
      })}
    >
      <p
        className={css({
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {label}
      </p>
      <p
        className={css({
          fontSize: 28,
          // fontWeight: "bold",
        })}
      >
        {value}
      </p>
    </div>
  )
}