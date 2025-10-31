"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { fmtnum } from "@/src/formatting";
import { useV1StabilityPoolLqtyGain } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { IconInfo } from "@liquity2/uikit";
import * as dn from "dnum";

const MIN_LQTY_THRESHOLD = dn.from(1000, 18); // 1000 LQTY

export function V1StabilityPoolBanner() {
  const account = useAccount();
  const v1LqtyGain = useV1StabilityPoolLqtyGain(account.address ?? null);

  const hasSignificantLqtyGain = Boolean(
    account.address
      && v1LqtyGain.data
      && dn.gt(v1LqtyGain.data, MIN_LQTY_THRESHOLD),
  );

  const lqtyAmount = v1LqtyGain.data;
  const formattedAmount = lqtyAmount ? fmtnum(lqtyAmount, { digits: 0 }) : "0";

  return (
    <InfoBanner
      show={hasSignificantLqtyGain}
      icon={<IconInfo size={16} />}
      messageDesktop={<>You have {formattedAmount} unclaimed LQTY in the V1 Stability Pool.</>}
      linkLabel="Claim and stake in V2"
      linkLabelMobile={`${formattedAmount} LQTY unclaimed in v1 - Claim & stake`}
      linkHref="https://docs.liquity.org/v2-faq/lqty-staking"
      linkExternal
    />
  );
}
