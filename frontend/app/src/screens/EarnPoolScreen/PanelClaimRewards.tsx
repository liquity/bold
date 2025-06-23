import type { BranchId, PositionEarn, TokenSymbol } from "@/src/types";
import type { Dnum } from "dnum";
import { ReactNode, useState } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import content from "@/src/content";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { getCollToken, isEarnPositionActive } from "@/src/liquity-utils";
import { getBranch } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { Checkbox, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { encodeFunctionData } from "viem";
import { useEstimateGas, useGasPrice } from "wagmi";

export function PanelClaimRewards({
  branchId,
  position,
}: {
  branchId: null | BranchId;
  position?: PositionEarn;
}) {
  const account = useAccount();
  const [compound, setCompound] = useState(false);

  const collateral = getCollToken(branchId);
  if (!collateral || branchId === null) {
    throw new Error(`Invalid branch: ${branchId}`);
  }

  const ethPrice = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");
  const collPriceUsd = usePrice(collateral.symbol);

  const isActive = isEarnPositionActive(position ?? null);

  const totalRewards = collPriceUsd.data && boldPriceUsd.data && dn.add(
    dn.mul(position?.rewards?.bold ?? DNUM_0, boldPriceUsd.data),
    dn.mul(position?.rewards?.coll ?? DNUM_0, collPriceUsd.data),
  );

  const branch = getBranch(branchId);
  const gasEstimate = useEstimateGas({
    account: account.address,
    data: encodeFunctionData({
      abi: branch.contracts.StabilityPool.abi,
      functionName: "withdrawFromSP",
      args: [0n, !compound], // withdraw 0, either claim or compound
    }),
    to: branch.contracts.StabilityPool.address,
  });

  const gasPrice = useGasPrice();

  const gasPriceEth = gasEstimate.data && gasPrice.data
    ? dnum18(gasEstimate.data * gasPrice.data)
    : null;

  const txGasPriceUsd = gasPriceEth && ethPrice.data
    && dn.mul(gasPriceEth, ethPrice.data);

  const allowSubmit = account.isConnected && totalRewards && dn.gt(totalRewards, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <Rewards
          amount={position?.rewards?.bold ?? DNUM_0}
          label={content.earnScreen.rewardsPanel.boldRewardsLabel}
          symbol="BOLD"
        />
        <Rewards
          amount={position?.rewards?.coll ?? DNUM_0}
          label={content.earnScreen.rewardsPanel.collRewardsLabel}
          symbol={collateral.symbol}
        />

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "24px 0",
            color: "contentAlt",
          })}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div>{content.earnScreen.rewardsPanel.totalUsdLabel}</div>
            <Amount
              prefix="$"
              value={totalRewards}
              format={2}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div>{content.earnScreen.rewardsPanel.expectedGasFeeLabel}</div>
            <Amount
              dust={false}
              format="2z"
              prefix="~$"
              value={txGasPriceUsd ?? 0}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          width: "100%",
          paddingTop: 24,
        }}
      >
        {isActive && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
              })}
            >
              <label
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  userSelect: "none",
                })}
              >
                <Checkbox
                  id="checkbox-compound-rewards"
                  checked={compound}
                  onChange={setCompound}
                />
                Compound BOLD rewards
              </label>
              <InfoTooltip
                content={{
                  heading: "Compound BOLD rewards",
                  body: (
                    <>
                      When enabled, your BOLD rewards will be automatically added back to your stability pool deposit,
                      earning you more rewards over time. Collateral rewards will still be claimed normally.
                    </>
                  ),
                }}
              />
            </div>
          </div>
        )}

        <FlowButton
          disabled={!allowSubmit}
          request={position && {
            flowId: "earnClaimRewards",
            backLink: [
              `/earn/${collateral.name.toLowerCase()}/claim`,
              "Back to earn position",
            ],
            successLink: ["/", "Go to the Dashboard"],
            successMessage: compound
              ? "The rewards have been compounded successfully."
              : "The rewards have been claimed successfully.",
            earnPosition: position,
            compound,
          }}
        />
      </div>
    </div>
  );
}

function Rewards({
  amount,
  label,
  symbol,
}: {
  amount: Dnum;
  label: ReactNode;
  symbol: TokenSymbol;
}) {
  return (
    <div
      className={css({
        display: "grid",
        gap: 24,
        medium: {
          gridTemplateColumns: "1.2fr 1fr",
        },
        alignItems: "start",
        padding: "24px 0",
        borderBottom: "1px solid token(colors.separator)",
      })}
    >
      <div>{label}</div>
      <div
        className={css({
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 8,
          fontSize: 20,
          medium: {
            justifyContent: "flex-end",
            fontSize: 28,
          },
        })}
      >
        <Amount value={amount} />
        <TokenIcon symbol={symbol} size={24} />
      </div>
    </div>
  );
}
