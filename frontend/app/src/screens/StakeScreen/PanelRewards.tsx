import type { TokenSymbol } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { getProtocolContract } from "@/src/contracts";
import { useDemoMode } from "@/src/demo-mode";
import { ACCOUNT_STAKED_LQTY } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { useStakePosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { Button, HFlex, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { encodeFunctionData } from "viem";
import { useEstimateGas, useGasPrice } from "wagmi";

export function PanelRewards() {
  const account = useAccount();
  const txFlow = useTransactionFlow();
  const demoMode = useDemoMode();

  const ethPrice = usePrice("ETH");

  const stakePosition = useStakePosition(account.address ?? null);
  const LqtyStaking = getProtocolContract("LqtyStaking");

  const gasEstimate = useEstimateGas({
    account: account.address,
    data: encodeFunctionData({
      abi: LqtyStaking.abi,
      functionName: "unstake",
      args: [0n],
    }),
    to: LqtyStaking.address,
  });

  const gasPrice = useGasPrice();

  if (!ethPrice.data) {
    return null;
  }

  const txGasPriceEth = gasEstimate.data && gasPrice.data
    ? dnum18(gasEstimate.data * gasPrice.data)
    : null;

  const txGasPriceUsd = txGasPriceEth && dn.mul(txGasPriceEth, ethPrice.data);

  const rewardsLusd = (
    demoMode.enabled
      ? ACCOUNT_STAKED_LQTY.rewardLusd
      : stakePosition.data?.rewards.lusd
  ) ?? dn.from(0, 18);

  const rewardsEth = (
    demoMode.enabled
      ? ACCOUNT_STAKED_LQTY.rewardEth
      : stakePosition.data?.rewards.eth
  ) ?? dn.from(0, 18);

  const totalRewardsUsd = dn.add(
    rewardsLusd,
    dn.mul(rewardsEth, ethPrice.data),
  );

  const allowSubmit = account.isConnected && dn.gt(totalRewardsUsd, 0);

  return (
    <VFlex gap={48}>
      <VFlex gap={0}>
        <Rewards
          amount={rewardsLusd}
          label="Issuance gain"
          symbol="LUSD"
        />
        <Rewards
          amount={rewardsEth}
          label="Redemption gain"
          symbol="ETH"
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
          <HFlex justifyContent="space-between" gap={24}>
            <div>Total in USD</div>
            <Amount
              format="2z"
              prefix="$"
              value={totalRewardsUsd}
            />
          </HFlex>
          <HFlex justifyContent="space-between" gap={24}>
            <div>Expected Gas Fee</div>
            <Amount
              format="2z"
              prefix="~$"
              value={txGasPriceUsd ?? 0}
            />
          </HFlex>
        </div>
      </VFlex>

      <ConnectWarningBox />

      <Button
        disabled={!allowSubmit}
        label="Next: Summary"
        mode="primary"
        size="large"
        wide
        onClick={() => {
          if (account.address && stakePosition.data) {
            txFlow.start({
              flowId: "stakeClaimRewards",
              backLink: [
                `/stake`,
                "Back to stake position",
              ],
              successLink: ["/", "Go to the Dashboard"],
              successMessage: "The rewards have been claimed successfully.",

              stakePosition: stakePosition.data,
              prevStakePosition: stakePosition.data,
            });
          }
        }}
      />
    </VFlex>
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
        gridTemplateColumns: "1.2fr 1fr",
        alignItems: "start",
        padding: "24px 0",
        borderBottom: "1px solid token(colors.separator)",
      })}
    >
      <div
        className={css({
          paddingTop: 4,
        })}
      >
        {label}
      </div>
      <div
        className={css({
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          fontSize: 28,
        })}
      >
        <Amount value={amount} />
        <TokenIcon symbol={symbol} size={24} />
      </div>
    </div>
  );
}
