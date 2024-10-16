import type { PositionStake } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, StrongCard, TokenIcon } from "@liquity2/uikit";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

export function PositionCardStake({
  deposit,
  rewards,
  share,
}: Pick<
  PositionStake,
  | "deposit"
  | "rewards"
  | "share"
>) {
  return (
    <Link
      href="/stake"
      legacyBehavior
      passHref
    >
      <StrongCard
        heading={[
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt2",
              })}
            >
              <IconStake size={16} />
            </div>
            LQTY stake
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <Amount
                value={rewards.lusd}
                format="2diff"
              />
              <TokenIcon
                size={24}
                symbol="LUSD"
              />
            </HFlex>
          ),
          label: (
            <HFlex gap={4} justifyContent="flex-start">
              <Amount value={rewards.eth} format="4diff" />
              <TokenIcon
                size="small"
                symbol="ETH"
              />
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
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Voting power
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    <Amount
                      value={share}
                      percentage
                    />
                  </div>
                </div>
              }
            />
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Deposit
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    <Amount
                      value={deposit}
                      suffix=" LQTY"
                    />
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
