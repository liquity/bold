"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import content from "@/src/content";
import { useStakePosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { AnchorTextButton, HFlex, Tabs, TokenIcon, VFlex } from "@liquity2/uikit";
import { useParams, useRouter } from "next/navigation";
import { PanelRewards } from "./PanelRewards";
import { PanelStaking } from "./PanelStaking";
import { PanelVoting } from "./PanelVoting";

const TABS = [
  { label: content.stakeScreen.tabs.deposit, id: "deposit" },
  { label: content.stakeScreen.tabs.rewards, id: "rewards" },
  { label: content.stakeScreen.tabs.voting, id: "voting" },
];

export function StakeScreen() {
  const router = useRouter();
  const { action = "deposit" } = useParams();
  const account = useAccount();
  const stakePosition = useStakePosition(account.address ?? null);

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.stakeScreen.headline(<TokenIcon size={24} symbol="LQTY" />)}
          </HFlex>
        ),
        subtitle: (
          <>
            {content.stakeScreen.subheading}{" "}
            <AnchorTextButton
              label={content.stakeScreen.learnMore[1]}
              href={content.stakeScreen.learnMore[0]}
              external
            />
          </>
        ),
      }}
      gap={48}
    >
      <StakePositionSummary
        stakePosition={stakePosition.data ?? null}
        loadingState={stakePosition.status}
      />
      <VFlex gap={24}>
        <Tabs
          items={TABS.map(({ label, id }) => ({
            label,
            panelId: `p-${id}`,
            tabId: `t-${id}`,
          }))}
          selected={TABS.findIndex(({ id }) => id === action)}
          onSelect={(index) => {
            const tab = TABS[index];
            if (!tab) {
              throw new Error("Invalid tab index");
            }
            router.push(`/stake/${tab.id}`, { scroll: false });
          }}
        />

        {action === "deposit" && <PanelStaking />}
        {action === "rewards" && <PanelRewards />}
        {action === "voting" && <PanelVoting />}
      </VFlex>
    </Screen>
  );
}
