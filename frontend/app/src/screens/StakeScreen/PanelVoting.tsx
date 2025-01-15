import type { InitiativeStatus } from "@/src/liquity-governance";
import type { Address, Dnum, Entries, Initiative, Vote, VoteAllocation, VoteAllocations } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Tag } from "@/src/comps/Tag/Tag";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import content from "@/src/content";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { fmtnum, formatDate } from "@/src/formatting";
import { useGovernanceState, useInitiatives, useInitiativesStates } from "@/src/liquity-governance";
import { useAccount } from "@/src/services/Ethereum";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useGovernanceUser } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import {
  AnchorTextButton,
  Button,
  IconDownvote,
  IconEdit,
  IconExternal,
  IconUpvote,
  shortenAddress,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useMemo, useRef, useState } from "react";

export function PanelVoting() {
  const txFlow = useTransactionFlow();

  const account = useAccount();
  const governanceState = useGovernanceState();
  const governanceUser = useGovernanceUser(account.address ?? null);
  const initiatives = useInitiatives();
  const initiativesStates = useInitiativesStates(initiatives.data?.map((i) => i.address) ?? []);

  const stakedLQTY: Dnum = [governanceUser.data?.stakedLQTY ?? 0n, 18];

  // vote allocations to be submitted
  const [inputVoteAllocations, setInputVoteAllocations] = useState<VoteAllocations>({});

  // current vote allocations
  const voteAllocations = useMemo(() => {
    const allocations: VoteAllocations = {};

    for (const allocation of governanceUser.data?.allocations ?? []) {
      const { voteLQTY, vetoLQTY } = allocation;

      const voteAllocation: VoteAllocation | null = voteLQTY > 0n
        ? { vote: "for", value: [voteLQTY, 18] }
        : vetoLQTY > 0n
        ? { vote: "against", value: [vetoLQTY, 18] }
        : null;

      if (voteAllocation) {
        allocations[allocation.initiative] = voteAllocation;
      }
    }

    return allocations;
  }, [governanceUser.data?.allocations]);

  // fill input vote allocations from user data
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
    setInputVoteAllocations(allocations);
  }, [governanceUser.status]);

  const isCutoff = governanceState.data?.period === "cutoff";

  const hasAnyAllocations = (governanceUser.data?.allocations ?? []).length > 0;

  const remainingVotingPower = Object.values(inputVoteAllocations).reduce(
    (remaining, voteData) => {
      if (voteData.vote !== null) {
        return dn.sub(remaining, voteData.value);
      }
      return remaining;
    },
    dn.from(1, 18),
  );

  const daysLeft = governanceState.data?.daysLeft ?? 0;
  const rtf = new Intl.RelativeTimeFormat("en", { style: "long" });
  const remaining = daysLeft > 1
    ? rtf.format(Math.ceil(daysLeft), "day")
    : daysLeft > (1 / 24)
    ? rtf.format(Math.ceil(daysLeft * 24), "hours")
    : rtf.format(Math.ceil(daysLeft * 24 * 60), "minute");

  const handleVote = (initiativeAddress: Address, vote: Vote | null) => {
    setInputVoteAllocations((prev) => ({
      ...prev,
      [initiativeAddress]: {
        vote: prev[initiativeAddress]?.vote === vote ? null : vote,
        value: dn.from(0),
      },
    }));
  };

  const handleVoteInputChange = (initiativeAddress: Address, value: Dnum) => {
    setInputVoteAllocations((prev) => ({
      ...prev,
      [initiativeAddress]: {
        vote: prev[initiativeAddress]?.vote ?? null,
        value: dn.div(value, 100),
      },
    }));
  };

  const allowSubmit = dn.lt(remainingVotingPower, 1) && (
    hasAnyAllocations || dn.gte(remainingVotingPower, 0)
  );

  const cutoffStartDate = governanceState.data && new Date(
    Number(governanceState.data.cutoffStart) * 1000,
  );
  const epochEndDate = governanceState.data && new Date(
    Number(governanceState.data.epochEnd) * 1000,
  );

  if (
    governanceState.status === "pending"
    || initiatives.status === "pending"
    || governanceUser.status === "pending"
  ) {
    return null;
  }

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
              Discuss
              <IconExternal size={16} />
            </>
          }
          href="https://voting.liquity.org/"
          external
        />
      </div>

      {isCutoff && (
        <div
          className={css({
            paddingTop: 16,
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              paddingLeft: 12,
              fontSize: 14,
              background: "yellow:50",
              border: "1px solid token(colors.yellow:200)",
              borderRadius: 8,
            })}
          >
            <div>
              <svg width="16" height="17" fill="none">
                <path
                  fill="#E1B111"
                  d="M.668 14.333h14.667L8 1.666.668 14.333Zm8-2H7.335v-1.334h1.333v1.334Zm0-2.667H7.335V6.999h1.333v2.667Z"
                />
              </svg>
            </div>
            <div>Only downvotes are accepted today.</div>
          </div>
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
            <th>{hasAnyAllocations ? "Allocation" : "Decision"}</th>
          </tr>
        </thead>
        <tbody>
          {initiatives.data?.map((initiative, index) => (
            <InitiativeRow
              key={index}
              disableFor={isCutoff}
              initiative={initiative}
              initiativesStatus={initiativesStates.data?.[initiative.address]?.status}
              inputVoteAllocation={inputVoteAllocations[initiative.address]}
              onVote={handleVote}
              onVoteInputChange={handleVoteInputChange}
              totalStaked={stakedLQTY}
              voteAllocation={voteAllocations[initiative.address]}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>
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
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 32,
          })}
        >
          <div
            className={css({
              paddingTop: 12,
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
          </div>
          <div>
            {cutoffStartDate && epochEndDate && (
              <div>
                {isCutoff ? "Upvotes ended on " : "Upvotes accepted until "}
                <time
                  dateTime={formatDate(cutoffStartDate, "iso")}
                  title={formatDate(cutoffStartDate, "iso")}
                >
                  {formatDate(cutoffStartDate)}
                </time>.
                {" Downvotes accepted until "}
                <time
                  dateTime={formatDate(epochEndDate, "iso")}
                  title={formatDate(epochEndDate, "iso")}
                >
                  {formatDate(epochEndDate)}
                </time>.
              </div>
            )}
            <div
              className={css({
                color: "contentAlt",
              })}
            >
              Votes for epoch #{String(governanceState.data.epoch)} will be snapshotted {remaining}.
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
            const voteAllocationsFiltered = { ...inputVoteAllocations };
            for (const [address, data] of Object.entries(inputVoteAllocations) as Entries<VoteAllocations>) {
              if (data.vote === null || dn.eq(data.value, 0)) {
                delete voteAllocationsFiltered[address];
              }
            }

            txFlow.start({
              flowId: "allocateVotingPower",
              backLink: ["/stake/voting", "Back"],
              successLink: ["/stake/voting", "Back to overview"],
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
  disableFor,
  initiative,
  initiativesStatus,
  inputVoteAllocation,
  onVote,
  onVoteInputChange,
  totalStaked,
  voteAllocation,
}: {
  disableFor: boolean;
  initiative: Initiative;
  initiativesStatus?: InitiativeStatus;
  inputVoteAllocation?: VoteAllocations[Address];
  onVote: (initiative: Address, vote: Vote) => void;
  onVoteInputChange: (initiative: Address, value: Dnum) => void;
  totalStaked: Dnum;
  voteAllocation?: VoteAllocation;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editIntent, setEditIntent] = useState(false);
  const editMode = editIntent || !voteAllocation?.vote;

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
              gap: 4,
            })}
            style={{
              height: editMode ? "auto" : 26 + 6 + 4,
            }}
          >
            <div
              className={css({
                textOverflow: "ellipsis",
                overflow: "hidden",
                maxWidth: 200,
              })}
            >
              {initiative.name ?? "Initiative"}
            </div>
            {initiativesStatus && (
              <div
                title={`Status: ${initiativesStatus}`}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  height: 16,
                  padding: "0 4px 1px",
                  fontSize: 12,
                  color: "infoSurfaceContent",
                  background: "infoSurface",
                  border: "1px solid token(colors.infoSurfaceBorder)",
                  borderRadius: 8,
                  userSelect: "none",
                })}
              >
                {initiativesStatus}
              </div>
            )}
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
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            height: "100%",
            paddingTop: 6,
          })}
        >
          {editMode
            ? (
              <VoteInput
                ref={inputRef}
                forDisabled={disableFor}
                onChange={(value) => {
                  onVoteInputChange(initiative.address, value);
                }}
                onVote={(vote) => {
                  onVote(initiative.address, vote);
                }}
                value={inputVoteAllocation?.value ?? null}
                vote={inputVoteAllocation?.vote ?? null}
              />
            )
            : (
              voteAllocation.vote && (
                <Vote
                  share={dn.div(voteAllocation?.value ?? [0n, 18], totalStaked)}
                  quantity={voteAllocation?.value ?? [0n, 18]}
                  vote={voteAllocation?.vote ?? null}
                  onEdit={() => {
                    setEditIntent(true);
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 0);
                  }}
                />
              )
            )}
        </div>
      </td>
    </tr>
  );
}

function Vote({
  onEdit,
  quantity,
  share,
  vote,
}: {
  onEdit?: () => void;
  quantity: Dnum;
  share: Dnum;
  vote: Vote;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
        })}
      >
        {vote === "for" && <IconUpvote size={20} />}
        {vote === "against" && <IconDownvote size={20} />}
        {fmtnum(share, 2, 100)}%
        <Button
          size="mini"
          title="Change"
          label={<IconEdit size={16} />}
          onClick={onEdit}
        />
      </div>
      <div
        className={css({
          color: "contentAlt",
          fontSize: 12,
        })}
      >
        {fmtnum(quantity, 2)} LQTY {vote === "for" ? "for" : "against"}
      </div>
    </div>
  );
}
