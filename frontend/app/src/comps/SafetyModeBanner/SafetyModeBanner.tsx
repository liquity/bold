"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { useSafetyMode, useShutdownStatus } from "@/src/liquity-utils";
import { token } from "@/styled-system/tokens";
import { IconWarning } from "@liquity2/uikit";

export function SafetyModeBanner() {
  const safetyMode = useSafetyMode();
  const shutdownStatus = useShutdownStatus();

  const shutdownBranchIds = new Set(
    shutdownStatus.data?.filter((b) => b.isShutdown).map((b) => b.branchId) ?? [],
  );

  const branchesInSafetyMode = (safetyMode.data?.branchesInSafetyMode ?? [])
    .filter((b) => !shutdownBranchIds.has(b.branchId));

  const branchNames = branchesInSafetyMode.map((b) => b.symbol).join(", ");

  return (
    <InfoBanner
      show={branchesInSafetyMode.length > 0}
      icon={<IconWarning size={16} />}
      messageDesktop={
        <>
          The {branchNames} branch{branchesInSafetyMode.length > 1 ? "es are" : " is"} in Safety Mode.
          Borrowing restrictions apply.
        </>
      }
      linkLabel="Learn more"
      linkLabelMobile="Safety Mode active"
      linkHref="https://docs.liquity.org/v2-faq/borrowing-and-liquidations#docs-internal-guid-fee4cc44-7fff-c866-9ccf-bac2da1b5222"
      linkExternal
      backgroundColor={token("colors.negativeStrong")}
    />
  );
}
