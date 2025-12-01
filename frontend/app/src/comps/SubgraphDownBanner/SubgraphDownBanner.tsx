"use client";

import { InfoBanner } from "@/src/comps/InfoBanner/InfoBanner";
import { useSubgraphIsDown } from "@/src/indicators/subgraph-indicator";
import { token } from "@/styled-system/tokens";
import { IconInfo } from "@liquity2/uikit";

export function SubgraphDownBanner() {
  const subgraphIsDown = useSubgraphIsDown();
  return (
    <InfoBanner
      show={subgraphIsDown}
      icon={<IconInfo size={16} />}
      messageDesktop={<>Liquity's data API is not available currently, some functionality might be restricted.</>}
      backgroundColor={token("colors.brandGolden")}
      foregroundColor={token("colors.brandGoldenContent")}
    />
  );
}
