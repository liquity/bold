"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { useLegacyPositions } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { IconWarning } from "@liquity2/uikit";

export function LegacyPositionsBanner() {
  const account = useAccount();
  const legacyPositions = useLegacyPositions(account.address ?? null);

  return (
    <InfoBanner
      show={Boolean(account.address && legacyPositions.data?.hasAnyPosition)}
      icon={<IconWarning size={16} />}
      messageDesktop={<>You still have open positions on Jpydf Legacy.</>}
      linkLabel="Check legacy positions"
      linkLabelMobile="Your Jpydf Legacy positions"
      linkHref="/legacy"
    />
  );
}
