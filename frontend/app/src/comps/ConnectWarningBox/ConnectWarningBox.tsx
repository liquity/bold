import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";

export function ConnectWarningBox() {
  const account = useAccount();

  return !account.isConnected && (
    <button
      type="button"
      onClick={() => {
        account.connect();
      }}
      className={`font-audiowide ${css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        padding: "12px 14px",
        background: "#ef8a6a",
        color: "white",
        border: "none",
        borderRadius: "50px",
        textTransform: "uppercase",
        fontSize: "12px",
        fontWeight: 400,
        lineHeight: "1.12",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: 2,
        },
        _active: {
          transform: "translateY(1px)",
        },
        _hover: {
          opacity: 0.9,
        },
      })}`}
    >
      please connect your wallet to continue
    </button>
  );
}
