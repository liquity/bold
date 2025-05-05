import type { FlowStepDeclaration } from "@/src/services/TransactionFlow";
import type { ComponentPropsWithoutRef } from "react";

import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { useStoredState } from "@/src/services/StoredState";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useAccount } from "@/src/wagmi-utils";
import { css, cx } from "@/styled-system/css";
import { Dropdown, IconChevronDown, TextButton } from "@liquity2/uikit";
import { match } from "ts-pattern";

export function TransactionStatus(
  props: ComponentPropsWithoutRef<FlowStepDeclaration["Status"]> & {
    approval?: "all" | "approve-only" | null;
  },
) {
  const { preferredApproveMethod } = useStoredState();
  return (
    <div
      className={cx(
        "tx-status",
        css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }),
      )}
    >
      {props.approval
        && (props.status === "idle" || props.status === "error")
        && <PreferredApproveMethodSelector selector={props.approval} />}
      <StatusText
        {...props}
        type={props.approval === "all" && preferredApproveMethod === "permit"
          ? "permission"
          : "transaction"}
      />
    </div>
  );
}

function TxLink({ txHash }: { txHash: string }) {
  const account = useAccount();
  return (
    <LinkTextButton
      label="transaction"
      href={account.safeStatus === null
        ? `${CHAIN_BLOCK_EXPLORER?.url}tx/${txHash}`
        : `https://app.safe.global/transactions/tx?id=multisig_${account.address}_${txHash}&safe=sep:${account.address}`}
      external
    />
  );
}

function StatusText(
  props: ComponentPropsWithoutRef<FlowStepDeclaration["Status"]> & {
    type: "transaction" | "permission";
  },
) {
  if (props.type === "permission") {
    return (
      <div>
        {match(props)
          .with({ status: "idle" }, () => (
            "This action will open your wallet to sign a permission."
          ))
          .with({ status: "awaiting-commit" }, () => (
            "Please sign the permission in your wallet."
          ))
          .with({ status: "confirmed" }, () => (
            "The permission has been signed."
          ))
          .with({ status: "error" }, () => (
            "An error occurred. Please try again."
          ))
          .otherwise(() => null)}
      </div>
    );
  }
  return (
    <div>
      {match(props)
        .with({ status: "idle" }, () => (
          "This action will open your wallet to sign the transaction."
        ))
        .with({ status: "awaiting-commit" }, ({ onRetry }) => (
          <>
            Please sign the transaction in your wallet.{" "}
            <TextButton
              label="Retry"
              onClick={onRetry}
            />
          </>
        ))
        .with({ status: "awaiting-verify" }, ({ artifact: txHash }) => (
          <>
            Waiting for the <TxLink txHash={txHash} /> to be confirmed…
          </>
        ))
        .with({ status: "confirmed" }, ({ artifact: txHash }) => (
          <>
            The <TxLink txHash={txHash} /> has been confirmed.
          </>
        ))
        .with({ status: "error" }, () => (
          "An error occurred. Please try again."
        ))
        .exhaustive()}
    </div>
  );
}

const approveMethodOptions = [{
  method: "permit",
  label: "Signature",
  secondary: "You will be asked to sign a message. Instant and no gas fees. Recommended.",
}, {
  method: "approve-amount",
  label: "Transaction",
  secondary: "You will be asked to approve the desired amount in your wallet via a transaction.",
}, {
  method: "approve-infinite",
  label: "Transaction (infinite)",
  secondary: "You will be asked to approve an infinite amount in your wallet via a transaction.",
}] as const;

function PreferredApproveMethodSelector({
  selector,
}: {
  selector: "all" | "approve-only";
}) {
  const { preferredApproveMethod, setState } = useStoredState();

  const options = approveMethodOptions.slice(
    selector === "approve-only" ? 1 : 0,
  );

  const currentOption = options.find(({ method }) => (
    method === preferredApproveMethod
  )) ?? (options[0] as typeof options[0]);

  const { clearError } = useTransactionFlow();

  return (
    <div
      className={css({
        display: "flex",
        gap: 4,
      })}
    >
      <div>Approve via</div>
      <Dropdown
        customButton={({ menuVisible }) => (
          <div
            className={css({
              display: "flex",
              gap: 4,
              color: "accent",
              borderRadius: 4,
              _groupFocusVisible: {
                outline: "2px solid token(colors.focused)",
                outlineOffset: 2,
              },
            })}
          >
            <div>{currentOption.label}</div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                transformOrigin: "50% 50%",
                transition: "transform 80ms",
              })}
              style={{
                transform: menuVisible ? "rotate(180deg)" : "rotate(0)",
              }}
            >
              <IconChevronDown size={16} />
            </div>
          </div>
        )}
        menuWidth={300}
        menuPlacement="top-end"
        items={options}
        selected={options.indexOf(currentOption)}
        floatingUpdater={({ computePosition, referenceElement, floatingElement }) => {
          return async () => {
            const container = referenceElement.closest(".tx-status");
            if (!container) {
              return;
            }

            const position = await computePosition(referenceElement, floatingElement);
            const containerRect = container.getBoundingClientRect();
            const x = containerRect.left + containerRect.width / 2
              - floatingElement.offsetWidth / 2;
            const y = position.y - floatingElement.offsetHeight - 32;

            floatingElement.style.left = `${x}px`;
            floatingElement.style.top = `${y}px`;
          };
        }}
        onSelect={(index) => {
          const method = options[index]?.method;
          if (method) {
            setState((state) => ({
              ...state,
              preferredApproveMethod: method,
            }));
            clearError();
          }
        }}
      />
    </div>
  );
}
