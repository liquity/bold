import content from "@/src/content";
import { detectTroveBranch } from "@/src/liquity-utils";
import { isTroveId } from "@/src/types";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { Button, InfoTooltip, TextInput } from "@liquity2/uikit";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfig as useWagmiConfig } from "wagmi";

export function ManualLoanIdInput() {
  const router = useRouter();
  const wagmiConfig = useWagmiConfig();
  const account = useAccount();
  const [troveId, setTroveId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectedBranch, setDetectedBranch] = useState<number | null>(null);
  const [error, setError] = useState<"invalid-format" | "not-found" | null>(null);

  useEffect(() => {
    if (!troveId) {
      setDetectedBranch(null);
      setError(null);
      return;
    }

    if (!isTroveId(troveId)) {
      setDetectedBranch(null);
      setError("invalid-format");
      return;
    }

    let cancelled = false;
    setDetecting(true);
    setError(null);

    detectTroveBranch(wagmiConfig, troveId)
      .then((detectedId) => {
        if (!cancelled) {
          setDetectedBranch(detectedId);
          setDetecting(false);
          setError(detectedId === null ? "not-found" : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetectedBranch(null);
          setDetecting(false);
          setError("not-found");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [troveId, wagmiConfig]);

  if (!account.address) {
    return null;
  }

  const handleNavigate = () => {
    if (!troveId || detectedBranch === null) return;

    const prefixedId = `${detectedBranch}:${troveId}`;
    router.push(`/loan?id=${encodeURIComponent(prefixedId)}`);
  };

  return (
    <div
      className={css({
        background: "token(colors.warningBox)",
        borderRadius: 8,
        marginBottom: 24,
      })}
    >
      <div
        className={css({
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 8,
        })}
      >
        {content.manualLoanIdInput.title}
      </div>
      <div
        className={css({
          fontSize: 14,
          marginBottom: 16,
          color: "token(colors.contentAlt)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        })}
      >
        {content.manualLoanIdInput.description}
        <InfoTooltip
          content={{
            heading: content.manualLoanIdInput.tooltip.heading,
            body: content.manualLoanIdInput.tooltip.body(account.address),
            footerLink: {
              label: content.manualLoanIdInput.tooltip.footerLink.label,
              href: content.manualLoanIdInput.tooltip.footerLink.href,
            },
          }}
        />
      </div>
      <div
        className={css({
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexGrow: 1,
            minWidth: 200,
          })}
        >
          <div
            className={css({
              display: "flex",
              gap: 12,
              alignItems: "center",
            })}
          >
            <TextInput
              value={troveId}
              onChange={setTroveId}
              placeholder={content.manualLoanIdInput.inputPlaceholder}
              className={css({
                flexGrow: 1,
              })}
            />
            <Button
              label={detecting ? content.manualLoanIdInput.buttonDetecting : content.manualLoanIdInput.buttonLabel}
              mode="primary"
              size="medium"
              disabled={!troveId || detecting || detectedBranch === null}
              onClick={handleNavigate}
            />
          </div>
          {error && (
            <div
              className={css({
                fontSize: 12,
                color: "token(colors.negative)",
              })}
            >
              {error === "invalid-format"
                ? content.manualLoanIdInput.errorInvalidFormat
                : content.manualLoanIdInput.errorNotFound}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
