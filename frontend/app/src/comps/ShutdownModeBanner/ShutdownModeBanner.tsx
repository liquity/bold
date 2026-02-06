"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { getBranch, useShutdownStatus } from "@/src/liquity-utils";
import { token } from "@/styled-system/tokens";
import { IconWarning } from "@liquity2/uikit";

export function ShutdownModeBanner() {
  const shutdownStatus = useShutdownStatus();

  const branchesInShutdown = shutdownStatus.data?.filter((b) => b.isShutdown) ?? [];
  const branchNames = branchesInShutdown.map((b) => getBranch(b.branchId).symbol).join(", ");

  return (
    <InfoBanner
      show={branchesInShutdown.length > 0}
      icon={<IconWarning size={16} />}
      messageDesktop={
        <>
          The {branchNames} branch{branchesInShutdown.length > 1 ? "es are" : " is"} in Shutdown Mode.
          Borrowing is no longer available.
        </>
      }
      linkLabel="Learn more"
      linkLabelMobile="Shutdown Mode active"
      linkHref="#"
      linkExternal
      backgroundColor={token("colors.negativeStrong")}
    />
  );
}
