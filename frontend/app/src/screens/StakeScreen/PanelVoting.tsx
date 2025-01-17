import type { InitiativeStatus } from "@/src/liquity-governance";
import type { Address, Dnum, Entries, Initiative, Vote, VoteAllocation, VoteAllocations } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import { Tag } from "@/src/comps/Tag/Tag";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import content from "@/src/content";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { fmtnum, formatDate } from "@/src/formatting";
import { useGovernanceState, useInitiatives, useInitiativesStates } from "@/src/liquity-governance";
import { useAccount } from "@/src/services/Ethereum";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useGovernanceUser } from "@/src/subgraph-hooks";
import { jsonStringifyWithBigInt } from "@/src/utils";
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

function isInitiativeStatusActive(
  status: InitiativeStatus,
): status is Exclude<InitiativeStatus, "disabled" | "nonexistent" | "unregisterable"> {
  return status !== "disabled" && status !== "nonexistent" && status !== "unregisterable";
}

function initiativeStatusLabel(status: InitiativeStatus) {
  if (status === "skip" || status === "claimable" || status === "claimed") {
    return "Active";
  }
  if (status === "warm up") {
    return "Warm-up period";
  }
  if (status === "unregisterable") {
    return "Unregistering";
  }
  if (status === "disabled") {
    return "Disabled";
  }
  return "";
}

function filterVoteAllocationsForSubmission(
  voteAllocations: VoteAllocations,
  initiativesStates: Record<Address, { status: InitiativeStatus }>,
) {
  const voteAllocationsFiltered = { ...voteAllocations };

  for (const [address, data] of Object.entries(voteAllocations) as Entries<VoteAllocations>) {
    // Filter out allocations with null or zero values. No need to explicitly set them to 0,
    // as allocated initiatives always get reset when allocating new votes.
    if (data.vote === null || dn.eq(data.value, 0)) {
      delete voteAllocationsFiltered[address];
    }

    // filter out invalid initiatives
    const initiativeStatus = initiativesStates[address]?.status;
    if (!isInitiativeStatusActive(initiativeStatus ?? "nonexistent")) {
      delete voteAllocationsFiltered[address];
    }
  }

  return voteAllocationsFiltered;
}

export function PanelVoting() {
  const txFlow = useTransactionFlow();

  const account = useAccount();
  const governanceState = useGovernanceState();
  const governanceUser = useGovernanceUser(account.address ?? null);
  const initiatives = useInitiatives();
  const initiativesStates = useInitiativesStates(initiatives.data?.map((i) => i.address) ?? []);

  const stakedLQTY: Dnum = [governanceUser.data?.stakedLQTY ?? 0n, 18];

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

  // vote allocations from user input
  const [inputVoteAllocations, setInputVoteAllocations] = useState<VoteAllocations>({});

  // fill input vote allocations from user data
  useEffect(() => {
    const allocations: VoteAllocations = {};
    const stakedLQTY: Dnum = [governanceUser.data?.stakedLQTY ?? 0n, 18];
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

  const hasAnyAllocationChange = useMemo(() => {
    if (!governanceUser.data || !initiativesStates.data) {
      return false;
    }

    const serialize = (allocations: VoteAllocations) => (
      jsonStringifyWithBigInt(
        Object.entries(allocations).sort(([a], [b]) => a.localeCompare(b)),
      )
    );

    // filter the current vote allocations − taking care of removing
    // disabled + allocated initiatives as removing them doesn’t count as a change
    const voteAllocationsFiltered = filterVoteAllocationsForSubmission(
      voteAllocations,
      initiativesStates.data,
    );

    const voteAllocationsToSubmit = filterVoteAllocationsForSubmission(
      inputVoteAllocations,
      initiativesStates.data,
    );

    return serialize(voteAllocationsFiltered) !== serialize(voteAllocationsToSubmit);
  }, [voteAllocations, inputVoteAllocations, initiativesStates.data]);

  const isCutoff = governanceState.data?.period === "cutoff";

  const hasAnyAllocations = (governanceUser.data?.allocations ?? []).length > 0;

  const remainingVotingPower = Object.entries(inputVoteAllocations).reduce(
    (remaining, [initiative, voteData]) => {
      if (voteData.vote === null) {
        return remaining;
      }
      const initiativeState = initiativesStates.data?.[initiative as Address];
      if (!isInitiativeStatusActive(initiativeState?.status ?? "nonexistent")) {
        return remaining;
      }
      return dn.sub(remaining, voteData.value);
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
    hasAnyAllocations
    || dn.gte(remainingVotingPower, 0)
    || hasAnyAllocationChange
  );

  const cutoffStartDate = governanceState.data && new Date(
    Number(governanceState.data.cutoffStart) * 1000,
  );
  const epochEndDate = governanceState.data && new Date(
    Number(governanceState.data.epochEnd) * 1000,
  );

  if (
    governanceState.status !== "success"
    || initiatives.status !== "success"
    || initiativesStates.status !== "success"
    || governanceUser.status !== "success"
  ) {
    return (
      <div
        className={css({
          height: 200,
          paddingTop: 40,
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 18,
            userSelect: "none",
          })}
        >
          <Spinner size={18} />
          Loading
        </div>
      </div>
    );
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
          {initiatives.data
            // remove inactive initiatives that are not voted on
            ?.filter((initiative) => {
              return isInitiativeStatusActive(
                initiativesStates.data?.[initiative.address]?.status ?? "nonexistent",
              ) || Boolean(voteAllocations[initiative.address]);
            })
            .sort((a, b) => {
              // 1. sort by allocation
              const allocationA = voteAllocations[a.address];
              const allocationB = voteAllocations[b.address];
              if (allocationA && !allocationB) return -1;
              if (!allocationA && allocationB) return 1;

              // 2. sort by status
              const statusA = initiativesStates.data?.[a.address]?.status ?? "nonexistent";
              const statusB = initiativesStates.data?.[b.address]?.status ?? "nonexistent";
              const isActiveA = isInitiativeStatusActive(statusA);
              const isActiveB = isInitiativeStatusActive(statusB);
              if (isActiveA && !isActiveB) return -1;
              if (!isActiveA && isActiveB) return 1;

              return 0;
            })
            .map((
              initiative,
              index,
            ) => {
              const status = initiativesStates.data?.[initiative.address]?.status;
              return (
                <InitiativeRow
                  key={index}
                  disabled={!isInitiativeStatusActive(status ?? "nonexistent")}
                  disableFor={isCutoff}
                  initiative={initiative}
                  initiativesStatus={status}
                  inputVoteAllocation={inputVoteAllocations[initiative.address]}
                  onVote={handleVote}
                  onVoteInputChange={handleVoteInputChange}
                  totalStaked={stakedLQTY}
                  voteAllocation={voteAllocations[initiative.address]}
                />
              );
            })}
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
            txFlow.start({
              flowId: "allocateVotingPower",
              backLink: ["/stake/voting", "Back"],
              successLink: ["/stake/voting", "Back to overview"],
              successMessage: "Your voting power has been allocated.",
              voteAllocations: filterVoteAllocationsForSubmission(
                inputVoteAllocations,
                initiativesStates.data ?? {},
              ),
            });
          }}
        />
      </VFlex>
    </section>
  );
}

function InitiativeRow({
  disableFor,
  disabled,
  initiative,
  initiativesStatus,
  inputVoteAllocation,
  onVote,
  onVoteInputChange,
  totalStaked,
  voteAllocation,
}: {
  disableFor: boolean;
  disabled: boolean;
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
  const editMode = (editIntent || !voteAllocation?.vote) && !disabled;

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
                title={`${initiativeStatusLabel(initiativesStatus)} (${initiativesStatus})`}
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
                  textTransform: "lowercase",

                  "--color-warning": "#121B44",
                  "--background-warning": "token(colors.warningAlt)",
                })}
                style={{
                  color: isInitiativeStatusActive(initiativesStatus) ? undefined : `var(--color-warning)`,
                  background: isInitiativeStatusActive(initiativesStatus) ? undefined : `var(--background-warning)`,
                  border: isInitiativeStatusActive(initiativesStatus) ? undefined : 0,
                }}
              >
                {initiativeStatusLabel(initiativesStatus)}
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
                againstDisabled={disabled}
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
              voteAllocation?.vote && (
                <Vote
                  onEdit={() => {
                    setEditIntent(true);
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 0);
                  }}
                  disabled={disabled}
                  share={dn.div(voteAllocation?.value ?? [0n, 18], totalStaked)}
                  vote={voteAllocation?.vote ?? null}
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
  disabled,
  share,
  vote,
}: {
  onEdit?: () => void;
  disabled: boolean;
  share: Dnum;
  vote: Vote;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        height: 34,
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
        <div
          title={`${fmtnum(share, 2, 100)}% of your voting power has been allocated to ${
            vote === "for" ? "upvote" : "downvote"
          } this initiative`}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
          })}
        >
          {vote === "for" && <IconUpvote size={24} />}
          {vote === "against" && <IconDownvote size={24} />}
          <div>
            {fmtnum(share, 2, 100)}%
          </div>
        </div>
        <Button
          disabled={disabled}
          size="mini"
          title="Change"
          label={<IconEdit size={20} />}
          onClick={onEdit}
          className={css({
            height: "34px!",
          })}
        />
      </div>
    </div>
  );
}
