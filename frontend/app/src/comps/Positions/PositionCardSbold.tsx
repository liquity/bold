import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { useSboldPosition } from "@/src/sbold";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, TokenIcon } from "@liquity2/uikit";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardSbold({
  owner,
}: {
  owner?: Address | null;
}) {
  const sboldPosition = useSboldPosition(owner ?? null);
  return (
    <PositionCard
      className="position-card position-card-sbold"
      href="/earn/sbold"
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
          sBOLD position
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
              value={sboldPosition.data?.bold}
              fallback="−"
              format={2}
            />
            <TokenIcon size="medium" symbol="BOLD" />
          </HFlex>
        ),
        label: (
          <HFlex gap={4} justifyContent="flex-start">
            BOLD deposited
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
                      value={null}
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
                      value={null}
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
                  sBOLD balance
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
                    value={sboldPosition.data?.sbold}
                    format={2}
                  />
                  <TokenIcon size="mini" symbol="SBOLD" />
                </div>
              </div>
            }
          />
        </CardRows>
      }
    />
  );
}
