"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { useSafetyMode } from "@/src/liquity-utils";
import { IconWarning } from "@liquity2/uikit";

export function SafetyModeBanner() {
  const safetyMode = useSafetyMode();

  const branchesInSafetyMode = safetyMode.data?.branchesInSafetyMode ?? [];
  const branchNames = branchesInSafetyMode.map((b) => b.symbol).join(", ");

  return (
    <InfoBanner
      show={Boolean(safetyMode.data?.isAnySafetyMode)}
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
    />
  );
}
