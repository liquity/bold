import type { PositionEarn } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { getCollToken, useEarnPool } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, TokenIcon } from "@liquity2/uikit";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardEarn({
  branchId,
  deposit,
  rewards,
}: Pick<
  PositionEarn,
  | "branchId"
  | "deposit"
  | "rewards"
>) {
  const token = getCollToken(branchId);
  const earnPool = useEarnPool(branchId);
  return (
    <PositionCard
      className="position-card position-card-earn"
      href={token ? `/earn/${token.symbol.toLowerCase()}` : ""}
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
          Earn position
        </div>,
      ]}
      contextual={
        <div
          className={css({
            color: "positionContent",
          })}
        >
          <IconEarn size={32} />
        </div>
      }
      main={{
        value: (
          <HFlex gap={8} alignItems="center" justifyContent="flex-start">
            <Amount
              value={deposit}
              fallback="−"
              format={2}
            />
            <TokenIcon size="medium" symbol="BOLD" />
          </HFlex>
        ),
        label: token && (
          <HFlex gap={4} justifyContent="flex-start">
            In the {token.name} stability pool
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
                      value={earnPool.data?.apr}
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
                      value={earnPool.data?.apr7d}
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
                  Rewards
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
                    value={rewards.bold}
                    format={2}
                  />
                  <TokenIcon size="mini" symbol="BOLD" />
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
                    value={rewards.coll}
                    format={2}
                  />
                  {token && <TokenIcon size="mini" symbol={token.symbol} />}
                </div>
              </div>
            }
          />
        </CardRows>
      }
    />
  );
}
