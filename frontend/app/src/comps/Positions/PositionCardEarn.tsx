import type { PositionEarn } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { useCollateral } from "@/src/liquity-utils";
import { useEarnPool } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, StrongCard, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

export function PositionCardEarn({
  collIndex,
  deposit,
  rewards,
}: Pick<
  PositionEarn,
  | "collIndex"
  | "deposit"
  | "rewards"
>) {
  const token = useCollateral(collIndex);
  const earnPool = useEarnPool(collIndex);
  return token && (
    <Link
      href={`/earn/${token.symbol.toLowerCase()}`}
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
              <IconEarn size={16} />
            </div>
            Earn position
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              <Amount value={deposit} format={2} />
              <TokenIcon size="medium" symbol="BOLD" />
            </HFlex>
          ),
          label: (
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
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Current APR
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    <Amount
                      fallback="−"
                      percentage
                      value={earnPool.data.apr}
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
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Rewards
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "strongSurfaceContent",
                    })}
                  >
                    <Amount value={rewards.bold} format={2} />
                    <TokenIcon size="mini" symbol="BOLD" />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "strongSurfaceContent",
                    })}
                  >
                    <Amount value={rewards.coll} format={2} />
                    <TokenIcon size="mini" symbol={token.symbol} />
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
