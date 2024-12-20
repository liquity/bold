import type { Address, Dnum, Initiative, Vote, VoteAllocations } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Tag } from "@/src/comps/Tag/Tag";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import content from "@/src/content";
import { formatDate } from "@/src/formatting";
import { useGovernanceState, useInitiatives, useInitiativeState, useUserStates } from "@/src/liquity-governance";
import { useAccount } from "@/src/services/Ethereum";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { AnchorTextButton, Button, IconExternal, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function PanelVoting() {
  const txFlow = useTransactionFlow();
  const initiatives = useInitiatives();
  const governanceState = useGovernanceState();

  const [voteAllocations, setVoteAllocations] = useState<VoteAllocations>({});

  const remainingVotingPower = Object.values(voteAllocations).reduce(
    (remaining, voteData) => {
      if (voteData.vote !== null) {
        return dn.sub(remaining, voteData.value);
      }
      return remaining;
    },
    dn.from(1, 18),
  );

  const handleVote = (initiativeAddress: Address, vote: Vote | null) => {
    setVoteAllocations((prev) => {
      return ({
        ...prev,
        [initiativeAddress]: {
          value: dn.from(0),
          vote: prev[initiativeAddress]?.vote === vote ? null : vote,
        },
      });
    });
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
            <Tag title={governanceState.data && formatDate(new Date(Number(governanceState.data.epochEnd) * 1000))}>
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
            <th>
              <abbr title="Total Value Locked">TVL</abbr>
            </th>
            <th title="Pair volume in 7 days">
              Pair vol<br /> in 7d
            </th>
            <th title="Votes distribution">
              Votes<br />distrib
            </th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {initiatives.data?.map((initiative, index) => (
            <InitiativeRow
              key={index}
              initiative={initiative}
              voteAllocations={voteAllocations}
              onVote={handleVote}
              onVoteInputChange={handleVoteInputChange}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
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

      <VFlex gap={48}>
        <ConnectWarningBox />

        <Button
          disabled={!allowSubmit}
          label="Cast votes"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            txFlow.start({
              flowId: "allocateVotingPower",
              backLink: ["/stake/voting", "Back"],
              successLink: ["/", "Go to the Dashboard"],
              successMessage: "Your voting power has been allocated.",
              voteAllocations,
            });
          }}
        />
      </VFlex>
    </section>
  );
}

function InitiativeRow({
  initiative,
  voteAllocations,
  onVote,
  onVoteInputChange,
}: {
  initiative: Initiative;
  voteAllocations: VoteAllocations;
  onVote: (initiative: Address, vote: Vote) => void;
  onVoteInputChange: (initiative: Address, value: Dnum) => void;
}) {
  const initiativeState = useInitiativeState(initiative.address);
  console.log(initiativeState.data);
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
            className={css({
              display: "flex",
              alignItems: "center",
              paddingTop: 6,
            })}
          >
            {initiative.name}
          </div>
          <div
            className={css({
              fontSize: 12,
              color: "contentAlt",
            })}
          >
            {initiative.protocol}
          </div>
        </div>
      </td>
      <td>
        <Amount
          fallback="−"
          format="compact"
          value={initiative.tvl}
        />
      </td>
      <td>
        <div>
          <Amount
            fallback="−"
            format="compact"
            value={initiative.pairVolume}
          />
        </div>
      </td>
      <td>
        <div>
          <Amount
            fallback="−"
            format={1}
            percentage
            value={initiative.votesDistribution}
          />
        </div>
      </td>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: 34,
          })}
        >
          <VoteInput
            value={voteAllocations[initiative.address]?.value ?? null}
            vote={voteAllocations[initiative.address]?.vote ?? null}
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
