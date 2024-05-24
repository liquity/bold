import type { SpringValue } from "@react-spring/web";
import type { Dnum } from "dnum";
import type { ComponentProps } from "react";

import content from "@/src/content";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { useEffect, useState } from "react";
import { stringify } from "viem";

type Stat = {
  amount: Dnum | string;
  label: string;
  token?: ComponentProps<typeof TokenIcon>["symbol"];
};

export function ProtocolStats() {
  const stats = useStats();

  const transitions = useTransition(stats, {
    keys: (stat) => stat.label,
    from: { progress: 0 },
    initial: { progress: 0 },
    enter: { progress: 1 },
    leave: { progress: 0, immediate: true },
    config: {
      mass: 1,
      tension: 1800,
      friction: 60,
    },
    trail: 60,
  });

  return (
    <section
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        padding: "0 24px",
        color: "content",
        border: "1px solid token(colors.border)",
        borderRadius: 8,
      })}
    >
      <h1>{content.home.statsBar.label}</h1>
      {stats.length > 0
        ? (
          <div
            className={css({
              display: "flex",
              gap: 32,
            })}
          >
            {transitions(({ progress }, item) => {
              return (
                <AmountUsd
                  key={stringify(item)}
                  amount={item.amount}
                  label={item.label}
                  progress={progress}
                  tokenSymbol={item.token}
                />
              );
            })}
          </div>
        )
        : (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              fontSize: 16,
            })}
          >
            Loading…
          </div>
        )}
    </section>
  );
}

function AmountUsd({
  amount,
  label,
  tokenSymbol,
  progress,
}: {
  amount?: Dnum | string;
  label: string;
  tokenSymbol?: ComponentProps<typeof TokenIcon>["symbol"];
  progress: SpringValue<number>;
}) {
  return (
    <div
      className={css({
        display: "flex",
        gap: 16,
        alignItems: "center",
      })}
    >
      {tokenSymbol && (
        <a.div
          className={css({
            display: "flex",
            width: 20,
            height: 20,
            transformOrigin: "50% 50%",
          })}
          style={{
            opacity: progress,
            transform: progress.to((v) => `scale(${1.4 - v * 0.4})`),
          }}
        >
          <TokenIcon symbol={tokenSymbol} size="small" />
        </a.div>
      )}
      <a.div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 8,
        })}
        style={{
          opacity: progress,
          transform: progress.to((v) => `scale(${1 - (1 - v) * 0.2})`),
        }}
      >
        <div>{label}</div>
        <span
          className={css({
            fontVariantNumeric: "tabular-nums",
          })}
        >
          {typeof amount === "string" ? amount : amount && dn.format(amount, {
            digits: 2,
            trailingZeros: true,
          })}
        </span>
        <span
          className={css({
            color: "contentAlt",
            userSelect: "none",
          })}
        >
          {" $"}
        </span>
      </a.div>
    </div>
  );
}

function formatMillions(amount: Dnum) {
  return dn.gt(amount, 1_000_000)
    ? `${dn.format(dn.div(amount, 1_000_000))}M`
    : dn.format(amount, { compact: true });
}

function useStats() {
  const [stats, setStats] = useState<Stat[]>([]);
  useEffect(() => {
    const update = () => {
      setStats([{
        amount: formatMillions([1_408_000_000n, 0]),
        label: "TVL",
      }, {
        amount: [13_72n + BigInt(-100 + Math.round(Math.random() * 200)), 2],
        label: "LQTY",
        token: "LQTY",
      }, {
        amount: [1_01n + BigInt(-10 + Math.round(Math.random() * 20)), 2],
        label: "BOLD",
        token: "BOLD",
      }, {
        amount: [3421_55n, 2],
        label: "ETH",
        token: "WETH",
      }]);
    };

    update();

    const timer = setInterval(update, 30_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return stats;
}
