import type { PositionEarn } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import {
  getCollToken,
  useEarnPool,
  useEarnPosition,
} from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, TokenIcon } from "@liquity2/uikit";
import Link from "next/link";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardEarn({
  owner,
  collIndex,
  deposit,
}: Pick<PositionEarn, "owner" | "collIndex" | "deposit">) {
  const token = getCollToken(collIndex);
  const earnPool = useEarnPool(collIndex);
  const earnPosition = useEarnPosition(collIndex, owner ?? null);

  return (
    <Link
      href={token ? `/earn/${token.symbol.toLowerCase()}` : ""}
      legacyBehavior
      passHref
    >
      <PositionCard
        heading={[
          <div
            key='start'
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
            <HFlex gap={8} alignItems='center' justifyContent='flex-start'>
              <Amount value={deposit} format={2} />
              <TokenIcon size='medium' symbol='USDN' />
            </HFlex>
          ),
          label: token && (
            <HFlex gap={4} justifyContent='flex-start'>
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
                      color: "positionContentAlt",
                    })}
                  >
                    Current APR
                  </div>
                  <div
                    className={css({
                      color: "positionContent",
                    })}
                  >
                    <Amount fallback='−' percentage value={earnPool.data.apr} />
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
                      fallback='−'
                      value={earnPosition.data?.rewards.bold}
                      format={2}
                    />
                    <TokenIcon size='mini' symbol='USDN' />
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
                      fallback='−'
                      value={earnPosition.data?.rewards.coll}
                      format={2}
                    />
                    {token && <TokenIcon size='mini' symbol={token.symbol} />}
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
