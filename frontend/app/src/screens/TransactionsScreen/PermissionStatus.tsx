import type { FlowStepDeclaration } from "@/src/services/TransactionFlow";
import type { ComponentPropsWithoutRef } from "react";

import { match } from "ts-pattern";

export function PermissionStatus(
  props: ComponentPropsWithoutRef<FlowStepDeclaration["Status"]>,
) {
  return (
    <>
      {match(props)
        .with({ status: "idle" }, () => (
          <>
            This action will open your wallet to sign a permission.
          </>
        ))
        .with({ status: "awaiting-commit" }, () => (
          <>
            Please sign the permission in your wallet.
          </>
        ))
        .with({ status: "awaiting-verify" }, () => null)
        .with({ status: "confirmed" }, () => (
          <>
            The permission has been signed.
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
