import type { Address, Dnum, Entries, Initiative, Vote, VoteAllocations } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Tag } from "@/src/comps/Tag/Tag";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import content from "@/src/content";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { formatDate } from "@/src/formatting";
import { useGovernanceState, useInitiatives } from "@/src/liquity-governance";
import { useAccount } from "@/src/services/Ethereum";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useGovernanceUser } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { AnchorTextButton, Button, IconExternal, shortenAddress, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useState } from "react";

export function PanelVoting() {
  const txFlow = useTransactionFlow();

  const account = useAccount();
  const governanceState = useGovernanceState();
  const governanceUser = useGovernanceUser(account.address ?? null);
  const initiatives = useInitiatives();

  const [voteAllocations, setVoteAllocations] = useState<VoteAllocations>({});

  useEffect(() => {
    const stakedLQTY: Dnum = [governanceUser.data?.stakedLQTY ?? 0n, 18];

    const allocations: VoteAllocations = {};
    for (const allocation of governanceUser.data?.allocations ?? []) {
      const vote = allocation.voteLQTY > 0n
        ? "for" as const
        : allocation.vetoLQTY > 0n
        ? "against" as const
        : null;

      if (vote === null) {
        continue;
      }

      const qty: Dnum = [
        vote === "for"
          ? allocation.voteLQTY
          : allocation.vetoLQTY,
        18,
      ];

      allocations[allocation.initiative] = {
        value: dn.div(qty, stakedLQTY),
        vote,
      };
    }
    setVoteAllocations(allocations);
  }, [governanceUser.status]);

  const remainingVotingPower = Object.values(voteAllocations).reduce(
    (remaining, voteData) => {
      if (voteData.vote !== null) {
        return dn.sub(remaining, voteData.value);
      }
      return remaining;
    },
    dn.from(1, 18),
  );

  const daysLeft = governanceState.data?.daysLeft ?? 0;
  const rtf = new Intl.RelativeTimeFormat("en", { style: "short" });
  const remaining = daysLeft > 1
    ? rtf.format(Math.ceil(daysLeft), "day")
    : rtf.format(Math.ceil(daysLeft * 24 * 60), "minute");

  const handleVote = (initiativeAddress: Address, vote: Vote | null) => {
    setVoteAllocations((prev) => ({
      ...prev,
      [initiativeAddress]: {
        vote: prev[initiativeAddress]?.vote === vote ? null : vote,
        value: dn.from(0),
      },
    }));
  };

  const handleVoteInputChange = (initiativeAddress: Address, value: Dnum) => {
    setVoteAllocations((prev) => ({
      ...prev,
      [initiativeAddress]: {
        vote: prev[initiativeAddress]?.vote ?? null,
        value: dn.div(value, 100),
      },
    }));
  };

  const allowSubmit = dn.lt(remainingVotingPower, 1) && dn.gte(remainingVotingPower, 0);

  return (
    <section
      className={css({
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        paddingTop: 24,
      })}
    >
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 20,
          paddingBottom: 32,
        })}
      >
        <h1
          className={css({
            fontSize: 20,
          })}
        >
          {content.stakeScreen.votingPanel.title}
        </h1>
        <div
          className={css({
            color: "contentAlt",
            fontSize: 14,
            "& a": {
              color: "accent",
              _focusVisible: {
                borderRadius: 2,
                outline: "2px solid token(colors.focused)",
                outlineOffset: 1,
              },
            },
          })}
        >
          {content.stakeScreen.votingPanel.intro}
        </div>
      </header>
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
        })}
      >
        {governanceState.data && (
          <div
            className={css({
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: 6,
            })}
          >
            Current voting round ends in{" "}
            <Tag
              title={governanceState.data
                && `Epoch ${governanceState.data.epoch} ends on the ${
                  formatDate(new Date(Number(governanceState.data.epochEnd) * 1000))
                }`}
            >
              {governanceState.data.daysLeftRounded} {governanceState.data.daysLeftRounded === 1 ? "day" : "days"}
            </Tag>
          </div>
        )}

        <AnchorTextButton
          label={
            <>
              Discuss on Discord
              <IconExternal size={16} />
            </>
          }
          href="https://discord.com/invite/2up5U32"
          external
        />
      </div>

      {governanceState.data?.period === "cutoff" && (
        <div>
          You can only veto today
        </div>
      )}

      <table
        className={css({
          width: "100%",
          borderCollapse: "collapse",
          userSelect: "none",
          "& thead": {
            "& th": {
              lineHeight: 1.2,
              fontSize: 12,
              fontWeight: 400,
              color: "contentAlt",
              textAlign: "right",
              verticalAlign: "bottom",
              padding: "8px 0",
              borderBottom: "1px solid token(colors.tableBorder)",
            },
            "& th:first-child": {
              textAlign: "left",
              width: "40%",
            },
          },
          "& tbody": {
            "& td": {
              verticalAlign: "top",
              fontSize: 14,
              textAlign: "right",
              padding: 8,
            },
            "& td:first-child": {
              paddingLeft: 0,
              textAlign: "left",
              width: "40%",
            },
            "& td:last-child": {
              paddingRight: 0,
            },
            "& td:nth-of-type(2) > div, & td:nth-of-type(3) > div, & td:nth-of-type(4) > div": {
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              minHeight: 34,
            },
            "& tr:last-child td": {
              paddingBottom: 16,
            },
          },
          "& tfoot": {
            fontSize: 14,
            color: "contentAlt",
            "& td": {
              borderTop: "1px solid token(colors.tableBorder)",
              padding: "16px 0 32px",
            },
            "& td:last-child": {
              textAlign: "right",
            },
          },
        })}
      >
        <thead>
          <tr>
            <th>
              Epoch<br /> Initiatives
            </th>
            <th>Allocation</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {initiatives.data?.map((initiative, index) => (
            <InitiativeRow
              key={index}
              initiative={initiative}
              voteAllocation={voteAllocations[initiative.address]}
              onVote={handleVote}
              onVoteInputChange={handleVoteInputChange}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              <div>
                Voting power left
              </div>
            </td>
            <td>
              <div
                className={css({
                  "--color-negative": "token(colors.negative)",
                })}
                style={{
                  color: dn.lt(remainingVotingPower, 0)
                    ? "var(--color-negative)"
                    : "inherit",
                }}
              >
                <Amount
                  format={2}
                  value={remainingVotingPower}
                  percentage
                />
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      {governanceState.data && (
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          })}
        >
          <div
            className={css({
              display: "flex",
              width: 20,
              height: 20,
              color: "strongSurfaceContent",
              background: "strongSurface",
              borderRadius: "50%",
            })}
          >
            <svg width="20" height="20" fill="none">
              <path
                clipRule="evenodd"
                fill="currentColor"
                fillRule="evenodd"
                d="m15.41 5.563-6.886 10.1-4.183-3.66 1.317-1.505 2.485 2.173 5.614-8.234 1.652 1.126Z"
              />
            </svg>
          </div>
          <div>
            <div>
              Votes & vetos are accepted on {formatDate(new Date(Number(governanceState.data.epochEnd) * 1000))}.<br />
            </div>
            <div
              className={css({
                color: "contentAlt",
              })}
            >
              Your votes for epoch #{String(governanceState.data.epoch)} will apply {remaining}.
            </div>
          </div>
        </div>
      )}

      <VFlex gap={48}>
        <ConnectWarningBox />
        <Button
          disabled={!allowSubmit}
          label="Cast votes"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            // Filter out allocations with no vote or zero value
            const voteAllocationsFiltered = { ...voteAllocations };
            for (const [address, data] of Object.entries(voteAllocations) as Entries<VoteAllocations>) {
              if (data.vote === null || dn.eq(data.value, 0)) {
                delete voteAllocationsFiltered[address];
              }
            }

            txFlow.start({
              flowId: "allocateVotingPower",
              backLink: ["/stake/voting", "Back"],
              successLink: ["/", "Go to the Dashboard"],
              successMessage: "Your voting power has been allocated.",
              voteAllocations: voteAllocationsFiltered,
            });
          }}
        />
      </VFlex>
    </section>
  );
}

function InitiativeRow({
  initiative,
  voteAllocation,
  onVote,
  onVoteInputChange,
}: {
  initiative: Initiative;
  voteAllocation?: VoteAllocations[Address];
  onVote: (initiative: Address, vote: Vote) => void;
  onVoteInputChange: (initiative: Address, value: Dnum) => void;
}) {
  return (
    <tr>
      <td>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
          })}
        >
          <div
            title={initiative.address}
            className={css({
              display: "flex",
              alignItems: "center",
              paddingTop: 6,
            })}
          >
            {initiative.name ?? "Initiative"}
          </div>
          <div>
            <AnchorTextButton
              external
              href={`${CHAIN_BLOCK_EXPLORER?.url}address/${initiative.address}`}
              title={initiative.address}
              label={initiative.protocol ?? shortenAddress(initiative.address, 4)}
              className={css({
                fontSize: 12,
                color: "contentAlt!",
              })}
            />
          </div>
        </div>
      </td>
      <td>
      </td>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: "100%",
            paddingTop: 6,
          })}
        >
          <VoteInput
            value={voteAllocation?.value ?? null}
            vote={voteAllocation?.vote ?? null}
            onChange={(value) => {
              onVoteInputChange(initiative.address, value);
            }}
            onVote={(vote) => {
              onVote(initiative.address, vote);
            }}
          />
        </div>
      </td>
    </tr>
  );
}
