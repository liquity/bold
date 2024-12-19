import type { FlowStepDeclaration } from "@/src/services/TransactionFlow";
import type { ComponentPropsWithoutRef } from "react";

import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { AnchorTextButton } from "@liquity2/uikit";
import { match } from "ts-pattern";

export function TransactionStatus(
  props: ComponentPropsWithoutRef<FlowStepDeclaration["Status"]>,
) {
  return (
    <>
      {match(props)
        .with({ status: "idle" }, () => (
          <>
            This action will open your wallet to sign the transaction.
          </>
        ))
        .with({ status: "awaiting-commit" }, () => (
          <>
            Please sign the transaction in your wallet.
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
          <>
            An error occurred. Please try again.
          </>
        ))
        .exhaustive()}
    </>
  );
}

function TxLink({ txHash }: { txHash: string }) {
  return (
    <AnchorTextButton
      label="transaction"
      href={`${CHAIN_BLOCK_EXPLORER?.url}tx/${txHash}`}
      external
    />
  );
}
