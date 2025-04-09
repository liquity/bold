"use client";

import * as dn from "dnum";
import { Positions } from "@/src/comps/Positions/Positions";
import { fmtnum } from "@/src/formatting";
import { usePrice } from "@/src/services/Prices";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";


export function HomeScreen() {
  const account = useAccount();

  const bvusdBalance = useBalance(account.address, "bvUSD");
  const sbvusdBalance = useBalance(account.address, "sbvUSD");
  const vcraftBalance = useBalance(account.address, "VCRAFT");

  const bvusdPrice = usePrice("bvUSD");
  const sbvusdPrice = usePrice("sbvUSD");
  const vcraftPrice = usePrice("VCRAFT");

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
          My Tokens
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
            link={{ label: "Buy", href: "/buy" }}
            subValues={[
              {
                label: "Value",
                value: `$${bvusdBalance.data && bvusdPrice.data
                  ? fmtnum(dn.mul(bvusdBalance.data, bvusdPrice.data), "2z")
                  : "0.00"
                  }`
              },
              {
                label: "Locked",
                value: `$${sbvusdBalance.data && sbvusdPrice.data
                  ? fmtnum(dn.mul(sbvusdBalance.data, sbvusdPrice.data), "2z")
                  : "0.00"
                  }`
              },
            ]}
          />
          <TokenCard
            token="sbvUSD"
            link={{ label: "Earn", href: "/earn" }}
            subValues={[
              {
                label: "Value",
                value: `$${sbvusdBalance.data && sbvusdPrice.data
                  ? fmtnum(dn.mul(sbvusdBalance.data, sbvusdPrice.data), "2z")
                  : "0.00"
                  }`
              },
              {
                label: "Apy",
                value: "10%"
              },
            ]}
          />
          <TokenCard
            token="VCRAFT"
            link={{ label: "Buy", href: "#" }}
            subValues={[
              {
                label: "Value",
                value: `$${vcraftBalance.data && vcraftPrice.data
                  ? fmtnum(dn.mul(vcraftBalance.data, vcraftBalance.data), "2z")
                  : "0.00"
                  }`
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export function TokenCard({
  token,
  link,
  subValues
}: {
  token: string,
  link?: { label: string, href: string },
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
        paddingBottom: 12,
      })}>
        <h1
          className={css({
            fontSize: 24,
            color: "content",
          })}>
          {token}
        </h1>
        <a href={link?.href}
          className={css({
            color: "accent",
            textDecoration: "none",
            _hover: {
              color: "goldLight",
            },
          })}>
          {link?.label}
        </a>
      </div>
      <div className={css({
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between"
      })}>
        {subValues.map((subValue, i) => (
          <SubValue key={subValue.label} label={subValue.label} value={subValue.value} index={i} />
        ))}
      </div>
    </div>
  )
}

function SubValue({ label, value, index }: { label: string, value: string, index: number }) {
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
          justifySelf: index === 0 ? "start" : "end",
        })}
      >
        {label}
      </p>
      <p
        className={css({
          fontSize: 28,
          justifySelf: index === 0 ? "start" : "end",
        })}
      >
        {value}
      </p>
    </div>
  )
}