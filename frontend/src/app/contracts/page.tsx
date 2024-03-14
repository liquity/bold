"use client";

import type { ReactNode } from "react";

import { ADDRESS_ZERO, shortenAddress } from "@/src/eth-utils";
import { useBoldBalance, useCloseTrove, useOpenTrove, useTroveDetails } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { useModal } from "connectkit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { ContractBorrowerOperations } from "./ContractBorrowerOperations";
import { ContractStabilityPool } from "./ContractStabilityPool";

export default function Home() {
  return (
    <div
      className={css({
        width: "100%",
      })}
    >
      <CardsGrid>
        <AccountDetails />
        <TroveDetails />
        <Liquity2Info />
      </CardsGrid>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 160,
          width: "100%",
          paddingTop: 80,
        })}
      >
        <ContractBorrowerOperations />
        <ContractStabilityPool />
      </div>
    </div>
  );
}

function AccountDetails() {
  const { setOpen } = useModal();
  const { disconnect } = useDisconnect();
  const { address } = useAccount();
  const balance = useBalance({ address: address ?? ADDRESS_ZERO });
  const boldBalance = useBoldBalance(address ?? ADDRESS_ZERO);

  const isLoading = balance.status === "pending" || boldBalance.status === "pending";
  const isError = balance.status === "error" || boldBalance.status === "error";

  return (
    <Card
      title="Account"
      action={address
        ? {
          label: "Disconnect",
          onClick: disconnect,
        }
        : {
          label: "Connect Wallet",
          onClick: () => setOpen(true),
        }}
    >
      {isLoading
        ? <div>loading…</div>
        : isError
        ? <div>error</div>
        : address && (
          <div>
            {[
              [
                "Address",
                <span title={address}>{shortenAddress(address, 4)}</span>,
              ] as const,
              [
                "ETH Balance",
                <span title={dn.format([balance.data?.value ?? 0n, 18])}>
                  {dn.format([balance.data?.value ?? 0n, 18], 2)}
                </span>,
              ] as const,
              [
                "BOLD Balance",
                <span>{dn.format([boldBalance.data, 18], 2)}</span>,
              ] as const,
            ].map(([label, value]) => (
              <div
                key={label}
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 80,
                  height: 32,
                })}
              >
                <div>{label}</div>
                <div>{value}</div>
              </div>
            ))}
          </div>
        )}
    </Card>
  );
}

function TroveDetails() {
  const { address } = useAccount();
  const troveDetails = useTroveDetails(address ?? ADDRESS_ZERO);

  const closeTrove = useCloseTrove(address ?? ADDRESS_ZERO);
  const openTrove = useOpenTrove(address ?? ADDRESS_ZERO, {
    maxFeePercentage: 100n * 10n ** 16n, // 100%
    boldAmount: 1800n * 10n ** 18n, // 1800 BOLD
    upperHint: address ?? ADDRESS_ZERO,
    lowerHint: address ?? ADDRESS_ZERO,
    interestRate: 5n * 10n ** 16n, // 5%
    value: 20n * 10n ** 18n, // 20 ETH
  });

  return (
    <Card
      title="Trove"
      action={match(troveDetails.data?.status)
        .with(
          P.union(
            "nonExistent",
            "closedByOwner",
            "closedByRedemption",
            "closedByLiquidation",
          ),
          () => ({
            label: "Open Trove",
            onClick: () => {
              const data = openTrove();
              console.log("openTrove", data);
            },
          }),
        )
        .with("active", () => ({
          label: "Close Trove",
          onClick: () => {
            const data = closeTrove();
            console.log("closeTrove", data);
          },
        }))
        .otherwise(() => undefined)}
    >
      {match(troveDetails)
        .with({ status: "pending" }, () => "loading…")
        .with({ status: "error" }, () => "error")
        .with({ status: "success", data: P.not(undefined) }, ({ data }) => (
          <div>
            {[
              ["Status", data.status],
              ["Stake", dn.format(data.stake) + " ETH"],
              ["Debt", dn.format(data.debt) + " BOLD"],
              ["Collateral", dn.format(data.collateral) + " ETH"],
              ["Interest Rate", dn.format(dn.mul(data.interestRate, 100)) + "%"],
            ].map(([label, value]) => (
              <div
                key={label}
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 80,
                  height: 32,
                })}
              >
                <div>{label}</div>
                <div>{value}</div>
              </div>
            ))}
          </div>
        ))
        .otherwise(() => "a")}
    </Card>
  );
}

function Liquity2Info() {
  return (
    <Card title="Liquity v2">
      <div>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 80,
            height: 32,
          })}
        >
          loading…
        </div>
      </div>
    </Card>
  );
}

function CardsGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 40,
        width: "100%",
        padding: "80px 0",
      })}
    >
      {children}
    </div>
  );
}

function Card({
  action,
  children,
  title,
}: {
  action?: {
    label: string;
    onClick: () => void;
  };
  children: ReactNode;
  title: string;
}) {
  return (
    <div
      className={css({
        height: 380,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 40,
        padding: 40,
        background: "#F7F7FF",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 40,
        })}
      >
        <h1
          className={css({
            fontSize: 20,
          })}
        >
          {title}
        </h1>
        {children}
      </div>
      {action && (
        <div
          className={css({
            display: "flex",
            justifyContent: "flex-end",
          })}
        >
          <button
            type="button"
            onClick={action.onClick}
            className={css({
              padding: "8px 16px",
              color: "white",
              fontSize: 14,
              background: "blue",
              borderRadius: 16,
              cursor: "pointer",
              _active: {
                transform: "translateY(1px)",
              },
            })}
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
