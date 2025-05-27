"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import content from "@/src/content";
import { useVault, useVaultPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { match } from "ts-pattern";
import { PanelUpdateVaultDeposit } from "./PanelUpdateVaultDeposit";
import { VaultPositionSummary } from "@/src/comps/VaultPositionSummary/VaultPositionSummary";


export function VaultPoolScreen() {
  const account = useAccount();

  const vaultPosition = useVaultPosition(account.address ?? null);
  const vault = useVault();
  const loadingState = vault.isLoading || vaultPosition.status === "pending" ? "loading" : "success";

  const tabsTransition = useTransition(loadingState, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  return (
    <Screen
      ready={loadingState === "success"}
      back={{
        href: "/earn",
        label: content.earnScreen.backButton,
      }}
      heading={
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 24,
          })}
        >
          <ScreenCard
            mode={match(loadingState)
              .returnType<"ready" | "loading">()
              .with("success", () => "ready")
              .with("loading", () => "loading")
              .exhaustive()}
            finalHeight={140}
          >
            {loadingState === "success"
              ? (
                <VaultPositionSummary
                  earnPosition={vaultPosition.data}
                />
              )
              : (
                <>
                  <div
                    className={css({
                      position: "absolute",
                      top: 16,
                      left: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      textTransform: "uppercase",
                      userSelect: "none",
                      fontSize: 12,
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                      })}
                    >
                      <IconEarn size={16} />
                    </div>
                    <div>
                      Earn Pool
                    </div>
                  </div>
                  <HFlex gap={8}>
                    Fetching Vault…
                    <Spinner size={18} />
                  </HFlex>
                </>
              )}
          </ScreenCard>
        </div>
      }
      className={css({
        position: "relative",
      })}
    >
      {tabsTransition((style, item) => (
        item === "success" && (
          <a.div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            })}
            style={{
              opacity: style.opacity,
            }}
          >
            <PanelUpdateVaultDeposit
              branchId={0}
              deposited={vault.data.totalDeposited ?? dn.from(0, 18)}
              position={vaultPosition.data}
            />
          </a.div>
        )
      ))}
    </Screen>
  );
}
