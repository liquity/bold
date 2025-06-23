"use client";

import { Amount } from "@/src/comps/Amount/Amount";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Screen } from "@/src/comps/Screen/Screen";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import content from "@/src/content";
import { useBribingClaim, useNamedInitiatives } from "@/src/liquity-governance";
import { useStakePosition } from "@/src/liquity-utils";
import type { Address, Dnum, Initiative } from "@/src/types";
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
  const initiativeNames = useMemo(() => {
    const nameMap = new Map<Address, string>();
    initiatives.forEach((i) => {
      nameMap.set(i.address.toLowerCase() as Address, i.name ?? shortenAddress(i.address, 6));
    });
    return nameMap;
  }, [initiatives]);

  const bribesByInitiative = useMemo(() => {
    const grouped = new Map<Address, {
      boldAmount: Dnum;
      bribeTokenAmount: Dnum;
      bribeTokenAddress: Address;
      epochs: number[];
    }>();

    bribingClaim.claimableInitiatives.forEach((claim) => {
      grouped.set(claim.initiative, claim);
    });

    return grouped;
  }, [bribingClaim.claimableInitiatives]);

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
          const initiativeName = initiativeNames.get(initiative.toLowerCase() as Address);
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
                className={css({
                  fontWeight: 500,
                })}
              >
                {initiativeName ?? shortenAddress(initiative, 6)}
              </div>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "contentAlt",
                  fontSize: 13,
                })}
              >
                <span
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <Amount value={data.boldAmount} format="2z" />
                  <TokenIcon symbol="BOLD" size={16} />
                </span>
                {dn.gt(data.bribeTokenAmount, 0) && (
                  <>
                    <span>+</span>
                    <span>
                      <Amount value={data.bribeTokenAmount} format="2z" /> {bribingClaim.bribeTokens.find((token) => (
                        token.address === data.bribeTokenAddress
                      ))?.symbol ?? "Unknown"}
                    </span>
                  </>
                )}
                <span
                  title={`Epochs: ${data.epochs.join(", ")}`}
                  className={css({
                    marginLeft: "auto",
                    fontSize: 12,
                    opacity: 0.7,
                  })}
                >
                  {data.epochs.length} epoch{data.epochs.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={css({
          paddingTop: 12,
          borderTop: "1px solid token(colors.separator)",
        })}
      >
        <div
          className={css({
            fontWeight: 500,
            marginBottom: 8,
          })}
        >
          Total rewards
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 4,
            color: "contentAlt",
            fontSize: 13,
            marginBottom: 16,
          })}
        >
          <span className={css({ display: "flex", alignItems: "center", gap: 4 })}>
            <Amount value={bribingClaim.totalBold} format="2z" />
            <TokenIcon symbol="BOLD" size={16} />
          </span>
          {bribingClaim.bribeTokens.map((token) => (
            <span key={token.address} className={css({ display: "flex", alignItems: "center", gap: 4 })}>
              <Amount value={token.amount} format="2z" />
              <span>{token.symbol}</span>
            </span>
          ))}
        </div>

        <FlowButton
          label="Claim all bribes"
          request={{
            flowId: "claimBribes",
            backLink: ["/stake", "Back to staking"],
            successLink: ["/stake", "Back to staking"],
            successMessage: "Bribes have been claimed successfully.",
            claimableInitiatives: bribingClaim.claimableInitiatives,
            totalBold: bribingClaim.totalBold,
            bribeTokens: bribingClaim.bribeTokens,
          }}
          size="medium"
        />
      </div>
    </div>
  );
}
