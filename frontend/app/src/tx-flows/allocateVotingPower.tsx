import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address, Initiative, VoteAllocation } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { getUserStates, useInitiatives } from "@/src/liquity-governance";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vVoteAllocations } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { IconDownvote, IconUpvote } from "@liquity2/uikit";
import { IconStake } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { writeContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "allocateVotingPower",
  {
    voteAllocations: vVoteAllocations(),
  },
);

export type AllocateVotingPowerRequest = v.InferOutput<typeof RequestSchema>;

export const allocateVotingPower: FlowDeclaration<AllocateVotingPowerRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const votesCount = Object.keys(request.voteAllocations).length;
    return (
      <div
        className={css({
          position: "relative",
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px",
          width: "100%",
          color: "positionContent",
          background: "position",
          userSelect: "none",
          borderRadius: 8,
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "flex-start",
            flexDirection: "column",
            paddingBottom: 12,
          })}
        >
          <h1
            title="LQTY Stake"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingBottom: 12,
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "strongSurfaceContent",
                fontSize: 12,
                textTransform: "uppercase",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  color: "strongSurfaceContentAlt2",
                })}
              >
                <IconStake size={16} />
              </div>
              LQTY Stake
            </div>
          </h1>
          <div
            className={css({
              flexGrow: 0,
              flexShrink: 0,
              display: "flex",
            })}
          >
          </div>
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
                fontSize: 40,
                lineHeight: 1,
                gap: 12,
              })}
            >
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 40,
                  paddingTop: 24,
                  paddingBottom: 24,
                })}
              >
                {votesCount}
              </div>
            </div>
            <div
              className={css({
                fontSize: 14,
                color: "token(colors.strongSurfaceContentAlt)",
              })}
            >
              Total votes
            </div>
          </div>
        </div>
      </div>
    );
  },

  Details({ request }) {
    const initiatives = useInitiatives();
    return (
      <>
        {Object.entries(request.voteAllocations).map(([address, vote]) => {
          const initiative = initiatives.data?.find((i) => i.address === address);
          return !initiative || !vote ? null : (
            <VoteAllocation
              key={address}
              initiative={initiative}
              vote={vote}
            />
          );
        })}
      </>
    );
  },

  steps: {
    allocateVotingPower: {
      name: () => "Cast votes",
      Status: TransactionStatus,

      async commit({ request, account, wagmiConfig, contracts }) {
        if (!account) {
          throw new Error("Account address is required");
        }
        const userStates = await getUserStates(wagmiConfig, account);

        const { voteAllocations } = request;
        const { unallocatedLQTY } = userStates;

        const initiativeAddresses = Object.keys(voteAllocations) as Address[];

        const allocationArgs = {
          initiatives: initiativeAddresses,
          votes: new Array(initiativeAddresses.length).fill(0n) as bigint[],
          vetos: new Array(initiativeAddresses.length).fill(0n) as bigint[],
        };

        let remainingLqty = unallocatedLQTY;

        for (const [index, address] of initiativeAddresses.entries()) {
          const vote = voteAllocations[address];
          if (!vote) {
            throw new Error("Vote not found");
          }

          let qty = dn.mul([unallocatedLQTY, 18], vote.value)[0];
          remainingLqty -= qty;

          // allocate any remaining LQTY to the last initiative
          // if (index === initiativeAddresses.length - 1 && remainingLqty > 0n) {
          //   qty += remainingLqty;
          // }

          if (vote?.vote === "for") {
            allocationArgs.votes[index] = qty;
          } else if (vote?.vote === "against") {
            allocationArgs.vetos[index] = qty;
          }
        }

        return writeContract(wagmiConfig, {
          ...contracts.Governance,
          functionName: "allocateLQTY",
          args: [
            [],
            allocationArgs.initiatives,
            allocationArgs.votes,
            allocationArgs.vetos,
          ],
        });
      },

      async verify({ wagmiConfig }, hash) {
        await verifyTransaction(wagmiConfig, hash);
      },
    },
  },

  async getSteps() {
    return ["allocateVotingPower"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};

function VoteAllocation({
  initiative,
  vote,
}: {
  initiative: Initiative;
  vote: VoteAllocation;
}) {
  return (
    <TransactionDetailsRow
      label={[
        initiative.name,
        initiative.protocol,
      ]}
      value={[
        <div
          className={css({
            display: "flex",
            gap: 4,
            alignItems: "center",
          })}
        >
          <Amount percentage value={vote.value} />
          {vote.vote === "for"
            ? <IconUpvote size={24} />
            : <IconDownvote size={24} />}
        </div>,
        <div
          className={css({
            display: "flex",
            gap: 4,
            alignItems: "center",
          })}
        >
          {vote.vote === "for" ? "Support" : "Oppose"}
        </div>,
      ]}
    />
  );
}
