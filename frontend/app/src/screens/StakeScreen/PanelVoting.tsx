import type { Dnum } from "@/src/types";
import type { UseQueryResult } from "@tanstack/react-query";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Tag } from "@/src/comps/Tag/Tag";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import content from "@/src/content";
import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { AnchorTextButton, Button, IconExternal, VFlex } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useState } from "react";

type InitiativeId = string;

type Initiative = {
  id: InitiativeId;
  name: string;
  protocol: string;
  tvl: Dnum;
  pairVolume: Dnum;
  votesDistribution: Dnum;
};

type Vote = "for" | "against";

function useInitiatives(): UseQueryResult<Initiative[]> {
  return useQuery({
    queryKey: ["initiatives"],
    queryFn: () => {
      return INITIATIVES_DEMO;
    },
  });
}

export function PanelVoting() {
  const initiatives = useInitiatives();

  const [votes, setVotes] = useState<
    Record<
      InitiativeId,
      { vote: Vote | null; value: Dnum }
    >
  >({});

  const remainingVotingPower = Object.values(votes).reduce(
    (remaining, voteData) => {
      if (voteData.vote !== null) {
        return dn.sub(remaining, voteData.value);
      }
      return remaining;
    },
    dn.from(1, 18),
  );

  const handleVote = (id: InitiativeId, vote: Vote | null) => {
    setVotes((prev) => ({
      ...prev,
      [id]: {
        value: dn.from(0),
        vote: prev[id]?.vote === vote ? null : vote,
      },
    }));
  };

  const handleVoteInputChange = (id: InitiativeId, value: Dnum) => {
    setVotes((prev) => ({
      ...prev,
      [id]: {
        vote: prev[id]?.vote ?? null,
        value: dn.div(value, 100),
      },
    }));
  };

  // const allowSubmit = dn.lt(remainingVotingPower, 1);
  const allowSubmit = false;

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
        <div
          className={css({
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 6,
          })}
        >
          Current voting round ends in <Tag>1 day</Tag>
        </div>

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
            <tr key={index}>
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
                <div title={`$${fmtnum(initiative.tvl, "full")}`}>
                  {fmtnum(initiative.tvl, "compact")}
                </div>
              </td>
              <td>
                <div title={`$${fmtnum(initiative.pairVolume, "full")}`}>
                  {fmtnum(initiative.pairVolume, "compact")}
                </div>
              </td>
              <td>
                <div>
                  {fmtnum(initiative.votesDistribution, 2, 100)}%
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
                    value={votes[initiative.id]?.value ?? null}
                    vote={votes[initiative.id]?.vote ?? null}
                    onChange={(value) => {
                      handleVoteInputChange(initiative.id, value);
                    }}
                    onVote={(vote) => handleVote(initiative.id, vote)}
                  />
                </div>
              </td>
            </tr>
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
          label="Coming soon: cast votes"
          mode="primary"
          size="large"
          wide
          onClick={() => {
          }}
        />
      </VFlex>
    </section>
  );
}

const INITIATIVES_DEMO: Initiative[] = [
  {
    id: "1",
    name: "WETH-BOLD 0.3%",
    protocol: "Uniswap V4",
    tvl: dn.from(2_420_000, 18),
    pairVolume: dn.from(1_420_000, 18),
    votesDistribution: dn.from(0.35, 18),
  },
  {
    id: "2",
    name: "WETH-BOLD 0.3%",
    protocol: "Uniswap V4",
    tvl: dn.from(2_420_000, 18),
    pairVolume: dn.from(1_420_000, 18),
    votesDistribution: dn.from(0.20, 18),
  },
  {
    id: "3",
    name: "crvUSD-BOLD 0.01%",
    protocol: "Curve V2",
    tvl: dn.from(2_420_000, 18),
    pairVolume: dn.from(1_420_000, 18),
    votesDistribution: dn.from(0.15, 18),
  },
  {
    id: "4",
    name: "3pool-BOLD 0.01%",
    protocol: "Curve V2",
    tvl: dn.from(2_420_000, 18),
    pairVolume: dn.from(1_420_000, 18),
    votesDistribution: dn.from(0.10, 18),
  },
  {
    id: "5",
    name: "3pool-BOLD 0.01%",
    protocol: "Curve V2",
    tvl: dn.from(2_420_000, 18),
    pairVolume: dn.from(1_420_000, 18),
    votesDistribution: dn.from(0.10, 18),
  },
  {
    id: "6",
    name: "3pool-BOLD 0.01%",
    protocol: "Curve V2",
    tvl: dn.from(2_420_000, 18),
    pairVolume: dn.from(1_420_000, 18),
    votesDistribution: dn.from(0.05, 18),
  },
  {
    id: "7",
    name: "DeFi Collective: BOLD incentives on Euler",
    protocol: "0x5305...1418",
    tvl: dn.from(0, 18),
    pairVolume: dn.from(0, 18),
    votesDistribution: dn.from(0.025, 18),
  },
  {
    id: "8",
    name: "DeFi Collective: BOLD-USDC on Balancer",
    protocol: "0x7179...9f8f",
    tvl: dn.from(0, 18),
    pairVolume: dn.from(0, 18),
    votesDistribution: dn.from(0, 18),
  },
];
