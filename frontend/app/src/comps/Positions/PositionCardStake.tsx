import type { PositionStake } from "@/src/types";

import { LQTY_SUPPLY } from "@/src/constants";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, StrongCard, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

export function PositionCardStake({
  deposit,
  rewards,
}: Pick<
  PositionStake,
  | "deposit"
  | "rewards"
>) {
  const votingPower = dn.div(rewards.lusd, LQTY_SUPPLY);
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
              +{dn.format(rewards.lusd, 2)}
              <TokenIcon
                size={24}
                symbol="LUSD"
              />
            </HFlex>
          ),
          label: (
            <HFlex gap={4} justifyContent="flex-start">
              <span>+{dn.format(rewards.eth, 4)}</span>
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
                    {dn.format(dn.mul(votingPower, 100), 4)}%
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
                    {dn.format(deposit, 2)} LQTY
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
