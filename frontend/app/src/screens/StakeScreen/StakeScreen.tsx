"use client";

import { Amount } from "@/src/comps/Amount/Amount";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Screen } from "@/src/comps/Screen/Screen";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import content from "@/src/content";
import { CHAIN_ID } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { useBribingClaim, useNamedInitiatives } from "@/src/liquity-governance";
import { useStakePosition } from "@/src/liquity-utils";
import type { Address, Initiative } from "@/src/types";
import { tokenIconUrl } from "@/src/utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { shortenAddress, Tabs, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
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
  const bribingClaim = useBribingClaim(account.address ?? null);
  const initiatives = useNamedInitiatives();

  return (
    <Screen
      heading={{
        title: (
          <div
            className={css({
              display: "flex",
              flexFlow: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "0 8px",
            })}
          >
            {content.stakeScreen.headline(<TokenIcon size={24} symbol="LQTY" />)}
          </div>
        ),
        subtitle: (
          <>
            {content.stakeScreen.subheading}{" "}
            <LinkTextButton
              label={content.stakeScreen.learnMore[1]}
              href={content.stakeScreen.learnMore[0]}
              external
            />
          </>
        ),
      }}
    >
      <StakePositionSummary
        stakePosition={stakePosition.data ?? null}
        loadingState={stakePosition.status}
      />
      {bribingClaim.data && bribingClaim.data.claimableInitiatives.length > 0 && (
        <div
          className={css({
            marginTop: -16,
            marginBottom: -32,
          })}
        >
          <BribesInfoBox
            bribingClaim={bribingClaim.data}
            initiatives={initiatives.data ?? []}
          />
        </div>
      )}
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

function BribesInfoBox({
  bribingClaim,
  initiatives,
}: {
  bribingClaim: NonNullable<ReturnType<typeof useBribingClaim>["data"]>;
  initiatives: Initiative[];
}) {
  const { claimableInitiatives } = bribingClaim;

  const bribesByInitiative = useMemo(() => (
    new Map(claimableInitiatives.map((claim) => [
      claim.initiative.toLowerCase() as Address,
      claim,
    ]))
  ), [claimableInitiatives]);

  const initiativesByAddress = useMemo(() => (
    new Map(initiatives.map((initiative) => [
      initiative.address.toLowerCase() as Address,
      initiative,
    ]))
  ), [initiatives]);

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        fontSize: 14,
        color: "content",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
        marginBottom: 16,
      })}
    >
      <div
        className={css({
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 4,
        })}
      >
        Claimable Bribes
      </div>

      <div
        className={css({
          color: "contentAlt",
          fontSize: 14,
          marginBottom: 8,
        })}
      >
        You have unclaimed bribe rewards from your past votes. Claim them below.
      </div>

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 12,
        })}
      >
        {[...bribesByInitiative.entries()].map(([initiative, data]) => {
          const initiativeData = initiativesByAddress.get(initiative.toLowerCase() as Address);
          const initiativeName = initiativeData?.name ?? shortenAddress(initiative, 6);
          const bribeToken = bribingClaim.bribeTokens.find((token) => token.address === data.bribeTokenAddress);
          return (
            <div
              key={initiative}
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 4,
              })}
            >
              <div
                title={initiative}
                className={css({
                  fontWeight: 500,
                })}
              >
                {initiativeName}
              </div>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "contentAlt",
                  fontSize: 13,
                  userSelect: "none",
                })}
              >
                <div
                  title={`${fmtnum(data.boldAmount)} BOLD`}
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <Amount
                    format={2}
                    title={null}
                    value={data.boldAmount}
                  />
                  <TokenIcon
                    size={16}
                    symbol="BOLD"
                    title={null}
                  />
                </div>
                {dn.gt(data.bribeTokenAmount, 0) && (
                  <div
                    title={`${fmtnum(data.bribeTokenAmount)} ${bribeToken?.symbol ?? "Unknown"}`}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <Amount
                      format={2}
                      title={null}
                      value={data.bribeTokenAmount}
                    />
                    <TokenIcon
                      size={16}
                      title={null}
                      token={{
                        icon: tokenIconUrl(CHAIN_ID, data.bribeTokenAddress),
                        name: bribeToken?.symbol ?? "Unknown",
                        symbol: bribeToken?.symbol ?? "Unknown",
                      }}
                    />
                  </div>
                )}
                <div
                  title={`Epochs: ${data.epochs.join(", ")}`}
                  className={css({
                    fontSize: 12,
                    opacity: 0.7,
                  })}
                >
                  {data.epochs.length} epoch{data.epochs.length > 1 ? "s" : ""}
                </div>
                <div
                  className={css({
                    marginLeft: "auto",
                  })}
                >
                  <FlowButton
                    label="Claim"
                    request={() => {
                      const claimData = bribingClaim.claimableInitiatives
                        .find((c) => c.initiative === initiative)?.claimData;
                      return claimData && {
                        flowId: "claimBribes",
                        backLink: ["/stake", "Back to staking"],
                        successLink: ["/stake", "Back to staking"],
                        successMessage: "Bribes have been claimed successfully.",
                        initiative,
                        initiativeName,
                        boldAmount: data.boldAmount,
                        bribeTokenAmount: data.bribeTokenAmount,
                        bribeTokenAddress: data.bribeTokenAddress,
                        bribeTokenSymbol: bribeToken?.symbol ?? "UNKNOWN",
                        claimData,
                      };
                    }}
                    size="mini"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
