import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { ReactNode } from "react";

import { getCollateralContract } from "@/src/contracts";
import { fmtnum } from "@/src/formatting";
import { getCollToken } from "@/src/liquity-utils";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { shortenAddress, TokenIcon } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import * as v from "valibot";

const FlowIdSchema = v.literal("claimCollateralSurplus");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  backLink: v.union([
    v.null(),
    v.tuple([
      v.string(), // path
      v.string(), // label
    ]),
  ]),
  successLink: v.tuple([
    v.string(), // path
    v.string(), // label
  ]),
  successMessage: v.string(),

  borrower: vAddress(),
  collSurplus: vDnum(),
  collIndex: vCollIndex(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "claimCollateral";

const stepNames: Record<Step, string> = {
  claimCollateral: "Claim remaining collateral",
};

export const claimCollateralSurplus: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const { collIndex, collSurplus, borrower } = flow.request;

    const collToken = getCollToken(collIndex);
    if (!collToken) {
      throw new Error("Invalid collateral index: " + collIndex);
    }

    const csp = getCollateralContract(collIndex, "CollSurplusPool");
    if (!csp) {
      throw new Error("Collateral surplus pool not found for collateral index: " + collIndex);
    }

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

  Details({ flow }) {
    const { collIndex } = flow.request;
    const collateral = getCollToken(collIndex);

    return (
      <div className="p-4">
        <p>
          This will claim all available collateral surplus from your unclaimed liquidated positions for the{" "}
          {collateral?.name} collateral. The total amount will be sent to your wallet.
        </p>
      </div>
    );
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  async getSteps() {
    return ["claimCollateral"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    const { collIndex } = request;
    const { contracts: collContracts } = contracts.collaterals[collIndex];
    if (stepId === "claimCollateral") {
      return {
        ...collContracts.BorrowerOperations,
        functionName: "claimCollateral",
        args: [],
      };
    }

    throw new Error("Invalid stepId: " + stepId);
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
