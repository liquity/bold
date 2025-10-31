"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { fmtnum } from "@/src/formatting";
import { useStakePosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { IconInfo } from "@liquity2/uikit";
import * as dn from "dnum";

export function V1StakingBanner() {
  const account = useAccount();
  const stakePositionV1 = useStakePosition(account.address ?? null, "v1");

  const hasV1Stake = Boolean(
    account.address
      && stakePositionV1.data
      && dn.gt(stakePositionV1.data.deposit, 0),
  );

  const v1Amount = stakePositionV1.data?.deposit;
  const formattedAmount = v1Amount ? fmtnum(v1Amount) : "0";

  return (
    <InfoBanner
      show={hasV1Stake}
      icon={<IconInfo size={16} />}
      messageDesktop={<>You have {formattedAmount} LQTY staked in V1.</>}
      linkLabel="Migrate to V2 to accrue voting power and earn bribes"
      linkLabelMobile={`${formattedAmount} LQTY in V1 - Migrate to V2`}
      linkHref="https://docs.liquity.org/v2-faq/lqty-staking"
      linkExternal
    />
  );
}
