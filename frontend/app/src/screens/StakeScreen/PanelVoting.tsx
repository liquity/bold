import type { InitiativeStatus, VoteTotals } from "@/src/liquity-governance";
import type { Address, Dnum, Entries, Initiative, Vote, VoteAllocation, VoteAllocations } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import { Tag } from "@/src/comps/Tag/Tag";
import { VoteInput } from "@/src/comps/VoteInput/VoteInput";
import content from "@/src/content";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { CHAIN_BLOCK_EXPLORER, CHAIN_ID } from "@/src/env";
import { fmtnum, formatDate } from "@/src/formatting";
import {
  useCurrentEpochBribes,
  useGovernanceState,
  useGovernanceUser,
  useInitiativesStates,
  useInitiativesVoteTotals,
  useNamedInitiatives,
  votingPower,
} from "@/src/liquity-governance";
import { usePrice } from "@/src/services/Prices";
import { tokenIconUrl } from "@/src/utils";
import { jsonStringifyWithBigInt } from "@/src/utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { Button, IconDownvote, IconEdit, IconExternal, IconUpvote, shortenAddress, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useMemo, useRef, useState } from "react";

function isInitiativeStatusActive(
  status: InitiativeStatus,
): status is Exclude<InitiativeStatus, "disabled" | "nonexistent" | "unregisterable" | "warm up"> {
  return status !== "disabled"
    && status !== "nonexistent"
    && status !== "unregisterable"
    && status !== "warm up";
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
  const account = useAccount();
  const governanceState = useGovernanceState();
  const governanceUser = useGovernanceUser(account.address ?? null);
  const initiatives = useNamedInitiatives();

  const initiativesAddresses = initiatives.data?.map((i) => i.address) ?? [];
  const initiativesStates = useInitiativesStates(initiativesAddresses);
  const currentBribes = useCurrentEpochBribes(initiativesAddresses);
  const voteTotals = useInitiativesVoteTotals(initiativesAddresses);

  const stakedLQTY = governanceUser.data?.stakedLQTY;
  const stakedOffset = governanceUser.data?.stakedOffset;
  const epochEnd = governanceState.data?.epochEnd;
  const absoluteAllocations = governanceUser.data?.allocations;

  // current vote allocations
  const [voteAllocations, setVoteAllocations] = useState<VoteAllocations>({});

  // vote allocations from user input
  const [inputVoteAllocations, setInputVoteAllocations] = useState<VoteAllocations>({});

  // fill input vote allocations from user data
  useEffect(() => {
    if (!stakedLQTY || !stakedOffset || !epochEnd || !absoluteAllocations) return;

    const stakedVotingPower = votingPower(
      stakedLQTY,
      stakedOffset,
      epochEnd,
    );

    if (stakedVotingPower === 0n) {
      setVoteAllocations({});
      setInputVoteAllocations({});
      return;
    }

    const allocations: VoteAllocations = {};

    for (const allocation of absoluteAllocations) {
      const vote = allocation.voteLQTY > 0n
        ? "for" as const
        : allocation.vetoLQTY > 0n
        ? "against" as const
        : null;

      if (vote === null) continue;

      // rounded to 4 decimals
      const value = (
        BigInt(1e4) * (
            vote === "for"
              ? votingPower(allocation.voteLQTY, allocation.voteOffset, epochEnd)
              : votingPower(allocation.vetoLQTY, allocation.vetoOffset, epochEnd)
          ) + stakedVotingPower / 2n
      ) / stakedVotingPower;

      allocations[allocation.initiative] = {
        vote,
        value: [value, 4],
      };
    }

    setVoteAllocations(allocations);
    setInputVoteAllocations(allocations);
  }, [stakedLQTY, stakedOffset, epochEnd, jsonStringifyWithBigInt(absoluteAllocations)]);

  const hasAnyAllocationChange = useMemo(() => {
    if (!governanceUser.data || !initiativesStates.data) {
      return false;
    }

    const serialize = (allocations: VoteAllocations) => (
      jsonStringifyWithBigInt(
        Object.entries(allocations).sort(([a], [b]) => a.localeCompare(b)),
      )
    );

    // filter the current vote allocations, taking care of removing
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

  const remainingVotingPower = useMemo(() => {
    let remaining = dn.from(1, 18);

    const combinedAllocations: Record<Address, Dnum> = {};
    const stakedLQTY = governanceUser.data?.stakedLQTY ?? 0n;
    const allocations = governanceUser.data?.allocations ?? [];

    // current allocations
    if (stakedLQTY > 0n) {
      for (const allocation of allocations) {
        const currentVoteAmount = allocation.voteLQTY > 0n
          ? allocation.voteLQTY
          : allocation.vetoLQTY;

        if (currentVoteAmount > 0n) {
          const proportion = dn.div([currentVoteAmount, 18], [stakedLQTY, 18]);
          combinedAllocations[allocation.initiative] = proportion;
        }
      }
    }

    // input allocations (takes precedence)
    for (const [address, voteData] of Object.entries(inputVoteAllocations) as Entries<VoteAllocations>) {
      if (voteData.vote !== null) {
        combinedAllocations[address] = voteData.value;
      } else {
        delete combinedAllocations[address];
      }
    }

    for (const [address, value] of Object.entries(combinedAllocations)) {
      // check if the initiative is still active
      const initiativeState = initiativesStates.data?.[address as Address];
      if (!isInitiativeStatusActive(initiativeState?.status ?? "nonexistent")) {
        continue;
      }
      remaining = dn.sub(remaining, value);
    }

    return remaining;
  }, [
    governanceUser.data,
    inputVoteAllocations,
    initiativesStates.data,
  ]);

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

  const allowSubmit = hasAnyAllocationChange && stakedLQTY && (
    (
      dn.eq(remainingVotingPower, 0) && hasAnyAllocations
    ) || (
      dn.eq(remainingVotingPower, 1)
    )
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
    || voteTotals.status !== "success"
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
          alignItems: "start",
          gap: 24,
          width: "100%",
          userSelect: "none",
        })}
      >
        {governanceState.data && (
          <div
            className={css({
              flexShrink: 1,
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 6,
            })}
          >
            <div
              className={css({
                flexShrink: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })}
            >
              Current voting round ends in{" "}
            </div>
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

        <div
          className={css({
            flexShrink: 0,
            display: "grid",
            justifyContent: "end",
          })}
        >
          <LinkTextButton
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
            ?.filter((initiative) => (
              isInitiativeStatusActive(
                initiativesStates.data?.[initiative.address]?.status ?? "nonexistent",
              ) || Boolean(
                voteAllocations[initiative.address],
              )
            ))
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
            .map((initiative, index) => {
              const status = initiativesStates.data?.[initiative.address]?.status;
              return (
                <InitiativeRow
                  key={index}
                  bribe={currentBribes.data?.[initiative.address]}
                  disabled={!isInitiativeStatusActive(status ?? "nonexistent")}
                  disableFor={isCutoff}
                  initiative={initiative}
                  initiativesStatus={status}
                  inputVoteAllocation={inputVoteAllocations[initiative.address]}
                  onVote={handleVote}
                  onVoteInputChange={handleVoteInputChange}
                  voteAllocation={voteAllocations[initiative.address]}
                  voteTotals={voteTotals.data?.[initiative.address]}
                />
              );
            })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              <div
                className={css({
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                })}
              >
                <div
                  className={css({
                    overflow: "hidden",
                    display: "flex",
                  })}
                >
                  <div
                    title="100% of your voting power needs to be allocated."
                    className={css({
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    })}
                  >
                    100% of your voting power needs to be allocated.
                  </div>
                </div>
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
                  {"Remaining: "}
                  <Amount
                    format={2}
                    value={remainingVotingPower}
                    percentage
                  />
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      <BribeMarketsInfo />

      {governanceState.data && (
        <div
          className={css({
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 32,
            medium: {
              gap: 16,
            },
          })}
        >
          <div
            className={css({
              paddingTop: 12,
            })}
          >
            <div
              className={css({
                position: "relative",
                display: "flex",
                width: 16,
                height: 16,
                color: "strongSurfaceContent",
                background: "strongSurface",
                borderRadius: "50%",
                medium: {
                  width: 20,
                  height: 20,
                },
              })}
            >
              <svg
                fill="none"
                viewBox="0 0 20 20"
                className={css({
                  position: "absolute",
                  inset: 0,
                })}
              >
                <path
                  clipRule="evenodd"
                  fill="currentColor"
                  fillRule="evenodd"
                  d="m15.41 5.563-6.886 10.1-4.183-3.66 1.317-1.505 2.485 2.173 5.614-8.234 1.652 1.126Z"
                />
              </svg>
            </div>
          </div>
          <div
            className={css({
              fontSize: 14,
              medium: {
                fontSize: 16,
              },
            })}
          >
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

      <FlowButton
        disabled={!allowSubmit}
        footnote={!allowSubmit && !stakedLQTY
          ? "You have no voting power to allocate. Please stake LQTY before voting."
          : !allowSubmit && hasAnyAllocations
          ? "You can reset your votes by allocating 0% to all initiatives."
          : allowSubmit && dn.eq(remainingVotingPower, 1)
          ? "Your votes will be reset to 0% for all initiatives."
          : null}
        label="Cast votes"
        request={{
          flowId: "allocateVotingPower",
          backLink: ["/stake/voting", "Back"],
          successLink: ["/stake/voting", "Back to overview"],
          successMessage: "Your voting power has been allocated.",
          voteAllocations: filterVoteAllocationsForSubmission(
            inputVoteAllocations,
            initiativesStates.data ?? {},
          ),
        }}
      />
    </section>
  );
}

function calculateVotesPct(
  governanceState?: { countedVoteLQTY: bigint; countedVoteOffset: bigint; epochEnd: bigint },
  initiativeState?: VoteTotals,
) {
  if (!governanceState || !initiativeState) return null;

  const totalVotingPower = votingPower(
    governanceState.countedVoteLQTY,
    governanceState.countedVoteOffset,
    governanceState.epochEnd,
  );

  if (totalVotingPower === 0n) return DNUM_0;

  const initiativeVotingPower = votingPower(
    initiativeState.voteLQTY,
    initiativeState.voteOffset,
    governanceState.epochEnd,
  );

  return dn.div(dnum18(initiativeVotingPower), dnum18(totalVotingPower));
}

function InitiativeRow({
  bribe,
  disableFor,
  disabled,
  initiative,
  initiativesStatus,
  inputVoteAllocation,
  onVote,
  onVoteInputChange,
  voteAllocation,
  voteTotals,
}: {
  bribe?: {
    boldAmount: Dnum;
    tokenAmount: Dnum;
    tokenAddress: Address;
    tokenSymbol: string;
  };
  disableFor: boolean;
  disabled: boolean;
  initiative: Initiative;
  initiativesStatus?: InitiativeStatus;
  inputVoteAllocation?: VoteAllocations[Address];
  onVote: (initiative: Address, vote: Vote) => void;
  onVoteInputChange: (initiative: Address, value: Dnum) => void;
  voteAllocation?: VoteAllocation;
  voteTotals?: VoteTotals;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editIntent, setEditIntent] = useState(false);
  const editMode = (editIntent || !voteAllocation?.vote) && !disabled;
  const boldPrice = usePrice(bribe ? "BOLD" : null);
  const bribeTokenPrice = usePrice(bribe ? bribe.tokenSymbol : null);
  const governanceState = useGovernanceState();
  const votesPct = calculateVotesPct(governanceState.data, voteTotals);

  return (
    <tr>
      <td>
        <div
          className={css({
            display: "grid",
          })}
        >
          <div
            title={initiative.address}
            className={css({
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              paddingTop: 6,
              gap: 4,
            })}
          >
            <div
              className={css({
                minWidth: 0,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
              })}
            >
              {initiative.url
                ? (
                  <LinkTextButton
                    external
                    href={initiative.url}
                    label={
                      <>
                        {initiative.name ?? "Initiative"}
                        <IconExternal size={16} />
                      </>
                    }
                  />
                )
                : (
                  initiative.name ?? "Initiative"
                )}
            </div>
            {initiativesStatus && (
              <div
                title={`${initiativeStatusLabel(initiativesStatus)} (${initiativesStatus})`}
                className={css({
                  display: "flex",
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
                  transform: "translateY(0.5px)",
                  whiteSpace: "nowrap",
                  "--color-warning": "token(colors.warningAltContent)",
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
            <LinkTextButton
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

          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            })}
            title="Percentage of incentives the initiative would receive according to the current votes"
          >
            <span>Votes:</span>
            <Amount title={null} value={votesPct} percentage />
          </div>

          {bribe && (dn.gt(bribe.boldAmount, 0) || dn.gt(bribe.tokenAmount, 0)) && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
              })}
              title="Available bribes for voting on this initiative"
            >
              <span>Bribing:</span>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                })}
              >
                {dn.gt(bribe.boldAmount, 0) && (
                  <div
                    title={`${fmtnum(bribe.boldAmount)} BOLD`}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <TokenIcon
                      symbol="BOLD"
                      size={12}
                      title={null}
                    />
                    <Amount
                      format="compact"
                      title={null}
                      value={bribe.boldAmount}
                    />
                    {boldPrice.data && (
                      <Amount
                        format="compact"
                        title={null}
                        prefix="($"
                        value={dn.mul(bribe.boldAmount, boldPrice.data)}
                        suffix=")"
                      />
                    )}
                  </div>
                )}
                {dn.gt(bribe.tokenAmount, 0) && (
                  <div
                    title={`${fmtnum(bribe.tokenAmount)} ${bribe.tokenSymbol} (${bribe.tokenAddress})`}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <TokenIcon
                      size={12}
                      title={null}
                      token={{
                        icon: tokenIconUrl(CHAIN_ID, bribe.tokenAddress),
                        name: bribe.tokenSymbol,
                        symbol: bribe.tokenSymbol,
                      }}
                    />
                    <Amount
                      format="compact"
                      title={null}
                      value={bribe.tokenAmount}
                    />
                    {bribeTokenPrice.data && (
                      <Amount
                        format="compact"
                        title={null}
                        prefix="($"
                        value={dn.mul(bribe.tokenAmount, bribeTokenPrice.data)}
                        suffix=")"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
            : voteAllocation?.vote
            ? (
              <Vote
                onEdit={() => {
                  setEditIntent(true);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
                disabled={disabled}
                share={voteAllocation.value}
                vote={voteAllocation.vote}
              />
            )
            : (
              <VoteInput
                ref={inputRef}
                forDisabled={true}
                againstDisabled={true}
                onChange={() => {}}
                onVote={() => {}}
                value={null}
                vote={null}
              />
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
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
            "--color-disabled": "token(colors.disabledContent)",
          })}
        >
          {vote === "for" && <IconUpvote size={24} />}
          {vote === "against" && (
            <div
              className={css({
                transform: "translateY(2px)",
                color: disabled ? "var(--color-disabled)" : undefined,
              })}
            >
              <IconDownvote size={24} />
            </div>
          )}
          <div
            title={`${fmtnum(share, "pct2")}% of your voting power has been allocated to ${
              vote === "for" ? "upvote" : "downvote"
            } this initiative`}
            className={css({
              width: 46,
            })}
            style={{
              textDecoration: disabled ? "line-through" : undefined,
              color: disabled ? "var(--color-disabled)" : undefined,
            }}
          >
            {fmtnum(share, { preset: "pct2", suffix: "%" })}
          </div>
        </div>
        <Button
          disabled={disabled}
          size="mini"
          title={disabled ? "Initiative disabled" : "Change allocation"}
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

function BribeMarketsInfo() {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        padding: 16,
        color: "content",
        background: "fieldSurface",
        border: "1px solid token(colors.border)",
        borderRadius: 8,
        marginBottom: 16,
        marginTop: -16,
        gap: {
          base: 16,
          medium: 16,
        },
      })}
    >
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          fontSize: 16,
          gap: {
            base: 16,
            medium: 0,
          },
        })}
      >
        <h1
          className={css({
            fontWeight: 600,
          })}
        >
          Bribe Markets in Liquity V2
        </h1>
        <p
          className={css({
            fontSize: 15,
            color: "contentAlt",
          })}
        >
          Initiatives may offer bribes to incentivize votes, which are displayed in the table above and can be claimed
          afterwards on this page.
        </p>
      </header>
      <div>
        <LinkTextButton
          external
          href="https://www.liquity.org/blog/bribe-markets-in-liquity-v2-strategic-value-for-lqty-stakers"
          label={
            <span
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "accent",
              })}
            >
              <span>Learn more about bribes</span>
              <IconExternal size={16} />
            </span>
          }
        />
      </div>
    </div>
  );
}
