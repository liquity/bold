import { useBreakpointName } from "@/src/breakpoints";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { Button } from "@liquity2/uikit";

type FlowRequest = Parameters<
  ReturnType<typeof useTransactionFlow>["start"]
>[0];

type FlowRequestParam = FlowRequest | null | undefined;

export function FlowButton({
  disabled,
  request,
  label,
}: {
  disabled?: boolean;
  request?: (() => FlowRequestParam) | FlowRequestParam;
  label?: string;
}) {
  const txFlow = useTransactionFlow();
  const breakpointName = useBreakpointName();
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 48,
      })}
    >
      <ConnectWarningBox />
      <Button
        className="flow-button"
        disabled={disabled || !request}
        label={label ?? "Next: Summary"}
        mode="primary"
        size={breakpointName === "small" ? "medium" : "large"}
        wide
        style={{
          height: breakpointName === "small" ? 56 : 72,
          fontSize: breakpointName === "small" ? 20 : 24,
          borderRadius: breakpointName === "small" ? 56 : 120,
        }}
        onClick={() => {
          if (typeof request === "function") {
            request = request();
          }
          if (request) {
            txFlow.start(request);
          }
        }}
      />
    </div>
  );
}
