import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { ReactNode } from "react";

import { fmtnum } from "@/src/formatting";
import { getBranch, getCollToken } from "@/src/liquity-utils";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vAddress, vBranchId, vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { shortenAddress, TokenIcon } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "claimCollateralSurplus",
  {
    borrower: vAddress(),
    collSurplus: vDnum(),
    branchId: vBranchId(),
  },
);

export type ClaimCollateralSurplusRequest = v.InferOutput<typeof RequestSchema>;

export const claimCollateralSurplus: FlowDeclaration<ClaimCollateralSurplusRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { branchId, collSurplus, borrower } = request;
    const collToken = getCollToken(branchId);
    return (
      <div
        className={css({
          overflow: "hidden",
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
          width: "100%",
          color: "strongSurfaceContent",
          background: "strongSurface",
          padding: 16,
          borderRadius: 8,
        })}
      >
        <h1
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
              userSelect: "none",
            })}
          >
            Collateral surplus
          </div>
        </h1>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              fontSize: 28,
              lineHeight: 1,
              gap: 12,
            })}
          >
            <div
              title={`${fmtnum(collSurplus)} ${collToken.symbol}`}
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 12,
              })}
            >
              <div>{fmtnum(collSurplus)}</div>
              <TokenIcon
                size={32}
                symbol={collToken.symbol}
              />
            </div>
          </div>
        </div>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            paddingTop: 32,
          })}
        >
          <GridItem label="Collateral">
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
              })}
            >
              {collToken.name}
            </div>
          </GridItem>
          <GridItem label="Account">
            {borrower && (
              <div
                title={borrower}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                })}
              >
                <Image
                  alt=""
                  width={20}
                  height={20}
                  src={blo(borrower)}
                  className={css({
                    display: "block",
                    borderRadius: 4,
                  })}
                />
                {shortenAddress(borrower, 4).toLowerCase()}
              </div>
            )}
          </GridItem>
        </div>
      </div>
    );
  },

  Details({ request }) {
    const { branchId } = request;
    const collateral = getCollToken(branchId);

    return (
      <div className="p-4">
        <p>
          This will claim all available collateral surplus from your unclaimed liquidated positions for the{" "}
          {collateral?.name} collateral. The total amount will be sent to your wallet.
        </p>
      </div>
    );
  },

  steps: {
    claimCollateral: {
      name: () => "Claim remaining collateral",
      Status: TransactionStatus,

      async commit(ctx) {
        const { branchId } = ctx.request;
        const branch = getBranch(branchId);
        return ctx.writeContract({
          ...branch.contracts.BorrowerOperations,
          functionName: "claimCollateral",
          args: [],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["claimCollateral"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};

function GridItem({
  children,
  label,
  title,
}: {
  children: ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 14,
      })}
    >
      <div
        title={title}
        className={css({
          color: "strongSurfaceContentAlt",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          color: "strongSurfaceContent",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        })}
      >
        {children}
      </div>
    </div>
  );
}
