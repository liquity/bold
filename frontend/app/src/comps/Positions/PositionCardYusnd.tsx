import type { PositionYusnd } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { css } from "@/styled-system/css";
import { HFlex, TokenIcon } from "@liquity2/uikit";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";
import Link from "next/link";
import { useYusndStats } from "@/src/yusnd";
import { EarnIcon } from "../ActionCard/SnailIcon";

export function PositionCardYusnd({
  usnd,
  yusnd,
}: Pick<
  PositionYusnd,
  | "usnd"
  | "yusnd"
>) {
  const stats = useYusndStats();
  const apr = stats.data?.apr ?? null;
  const apr7d = stats.data?.apr7d ?? null;
  return (
    <Link href={`/earn/yusnd`} legacyBehavior passHref>
      <PositionCard
        className="position-card position-card-yusnd"
        heading={[
          <div
            key="start"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "positionContent",
            })}
          >
            yUSND position
          </div>,
        ]}
        contextual={
          <div
            className={css({
              color: "positionContent",
            })}
          >
            {/* <IconEarn size={32} /> */}
            <EarnIcon size={32} />
          </div>
        }
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <Amount
                value={usnd}
                fallback="−"
                format={2}
              />
              <TokenIcon size="medium" symbol="USND" />
            </HFlex>
          ),
          label: (
            <HFlex gap={4} justifyContent="flex-start">
              USND deposited
            </HFlex>
          ),
        }}
        secondary={
          <CardRows>
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 12,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      gap: 8,
                    })}
                  >
                    <div
                      className={css({
                        color: "positionContentAlt",
                      })}
                    >
                      APR
                    </div>
                    <div
                      className={css({
                        color: "positionContent",
                      })}
                    >
                      <Amount
                        fallback="−"
                        percentage
                        value={apr}
                      />
                    </div>
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      gap: 8,
                    })}
                  >
                    <div
                      className={css({
                        color: "positionContentAlt",
                      })}
                    >
                      7d APR
                    </div>
                    <div
                      className={css({
                        color: "positionContent",
                      })}
                    >
                      <Amount
                        fallback="−"
                        percentage
                        value={apr7d}
                      />
                    </div>
                  </div>
                </div>
              }
            />
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "positionContentAlt",
                    })}
                  >
                    yUSND balance
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "positionContent",
                    })}
                  >
                    <Amount
                      fallback="−"
                      value={yusnd}
                      format={2}
                    />
                    <TokenIcon size="mini" symbol="YUSND" title="Yield-bearing USND optimized by Yearn." />
                  </div>
                </div>
              }
            />
          </CardRows>
        }
      />
    </Link>
  );
}
