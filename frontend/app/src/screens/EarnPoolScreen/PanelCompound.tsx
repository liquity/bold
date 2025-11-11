import type { BranchId, PositionEarn } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import content from "@/src/content";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { getCollToken } from "@/src/liquity-utils";
import { getBranch } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import * as dn from "dnum";
import { encodeFunctionData } from "viem";
import { useEstimateGas, useGasPrice } from "wagmi";
import { Rewards } from "./components/Rewards";

export function PanelCompound({
  branchId,
  position,
}: {
  branchId: null | BranchId;
  position?: PositionEarn;
}) {
  const account = useAccount();

  const collateral = getCollToken(branchId);
  if (!collateral || branchId === null) {
    throw new Error(`Invalid branch: ${branchId}`);
  }

  const ethPrice = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");
  const collPriceUsd = usePrice(collateral.symbol);

  const boldRewardsUsd = boldPriceUsd.data && dn.mul(position?.rewards?.bold ?? DNUM_0, boldPriceUsd.data);
  const collRewardsUsd = collPriceUsd.data && dn.mul(position?.rewards?.coll ?? DNUM_0, collPriceUsd.data);

  const branch = getBranch(branchId);
  const gasEstimate = useEstimateGas({
    account: account.address,
    data: encodeFunctionData({
      abi: branch.contracts.StabilityPool.abi,
      functionName: "withdrawFromSP",
      args: [0n, false], // withdraw 0, don't claim
    }),
    to: branch.contracts.StabilityPool.address,
  });

  const gasPrice = useGasPrice();

  const gasPriceEth = gasEstimate.data && gasPrice.data
    ? dnum18(gasEstimate.data * gasPrice.data)
    : null;

  const txGasPriceUsd = gasPriceEth && ethPrice.data
    && dn.mul(gasPriceEth, ethPrice.data);

  const allowSubmit = account.isConnected && dn.gt(position?.rewards?.bold ?? DNUM_0, DNUM_0);

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
          amountUsd={boldRewardsUsd ?? DNUM_0}
          label={content.earnScreen.compoundPanel.boldRewardsLabel}
          symbol="BOLD"
        />
        <Rewards
          amount={position?.rewards?.coll ?? DNUM_0}
          amountUsd={collRewardsUsd ?? DNUM_0}
          label={content.earnScreen.compoundPanel.collRewardsLabel(collateral.name)}
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
            <div>{content.earnScreen.compoundPanel.expectedGasFeeLabel}</div>
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
        <FlowButton
          disabled={!allowSubmit}
          label={content.earnScreen.compoundPanel.action}
          request={position && {
            flowId: "earnClaimRewards",
            backLink: [
              `/earn/${collateral.name.toLowerCase()}/claim`,
              "Back to earn position",
            ],
            successLink: ["/", "Go to the Dashboard"],
            successMessage: "The BOLD rewards have been successfully compounded.",
            earnPosition: position,
            compound: true,
          }}
        />
      </div>
    </div>
  );
}
