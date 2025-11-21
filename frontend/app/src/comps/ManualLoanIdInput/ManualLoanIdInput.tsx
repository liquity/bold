import content from "@/src/content";
import { detectTroveBranches, getCollToken } from "@/src/liquity-utils";
import type { BranchId } from "@/src/types";
import { isTroveId } from "@/src/types";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { Button, InfoTooltip, TextInput, TokenIcon } from "@liquity2/uikit";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfig as useWagmiConfig } from "wagmi";

export function ManualLoanIdInput() {
  const router = useRouter();
  const wagmiConfig = useWagmiConfig();
  const account = useAccount();
  const [troveId, setTroveId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectedBranches, setDetectedBranches] = useState<BranchId[]>([]);
  const [error, setError] = useState<"invalid-format" | "not-found" | null>(null);

  useEffect(() => {
    if (!troveId) {
      setDetectedBranches([]);
      setError(null);
      return;
    }

    if (!isTroveId(troveId)) {
      setDetectedBranches([]);
      setError("invalid-format");
      return;
    }

    let cancelled = false;
    setDetecting(true);
    setError(null);

    detectTroveBranches(wagmiConfig, troveId)
      .then((branches) => {
        if (!cancelled) {
          setDetectedBranches(branches);
          setDetecting(false);
          setError(branches.length === 0 ? "not-found" : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetectedBranches([]);
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

  const handleNavigate = (branchId?: BranchId) => {
    if (!troveId || detectedBranches.length === 0) return;

    const selectedBranch = branchId ?? detectedBranches[0];
    const prefixedId = `${selectedBranch}:${troveId}`;
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
            {detectedBranches.length === 1 && (
              <Button
                label={detecting ? content.manualLoanIdInput.buttonDetecting : content.manualLoanIdInput.buttonLabel}
                mode="primary"
                size="medium"
                disabled={!troveId || detecting}
                onClick={() => handleNavigate()}
              />
            )}
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
          {detectedBranches.length > 1 && (
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 14,
                color: "token(colors.contentAlt)",
              })}
            >
              <div>{content.manualLoanIdInput.foundMultipleBranches}</div>
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                })}
              >
                {detectedBranches.map((branchId) => {
                  const token = getCollToken(branchId);
                  return (
                    <button
                      key={branchId}
                      type="button"
                      onClick={() => handleNavigate(branchId)}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        height: 40,
                        padding: "0 16px 0 8px",
                        fontSize: 18,
                        fontWeight: 500,
                        background: "background",
                        border: "1px solid token(colors.border)",
                        borderRadius: 20,
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "all 80ms",
                        _hover: {
                          background: "token(colors.controlSurfaceHover)",
                          borderColor: "token(colors.borderHover)",
                        },
                        _active: {
                          transform: "scale(0.98)",
                        },
                      })}
                    >
                      <TokenIcon symbol={token.symbol} size={24} />
                      <div>{token.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
