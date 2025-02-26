import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { TextButton } from "@liquity2/uikit";

export function ConnectWarningBox() {
  const account = useAccount();

  return !account.isConnected && (
    <div
      className={css({
        paddingTop: 16,
      })}
    >
      <div
        className={css({
          padding: "20px 24px",
          textAlign: "center",
          background: "secondary",
          borderRadius: 8,
        })}
      >
        Please{" "}
        <TextButton
          label="connect"
          onClick={() => {
            account.connect();
          }}
        />{" "}
        your wallet to continue.
      </div>
    </div>
  );
}
