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
      messageDesktop={<>Some data is not currently available (The Graph), functionality might be restricted.</>}
      linkLabel="Learn more"
      linkHref="https://docs.liquity.org/v2-faq/borrowing-and-liquidations#what-happens-when-the-graph-is-down"
      linkExternal
      backgroundColor={token("colors.brandGolden")}
      foregroundColor={token("colors.brandGoldenContent")}
    />
  );
}
