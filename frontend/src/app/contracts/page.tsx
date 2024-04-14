"use client";

import type { ReactNode } from "react";

import { ADDRESS_ZERO, shortenAddress } from "@/src/eth-utils";
import {
  getTroveId,
  useAccountBalances,
  useCloseTrove,
  useLiquity2Info,
  useOpenTrove,
  useStabilityPoolStats,
  useTapCollTokenFaucet,
  useTroveDetails,
} from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { useModal } from "connectkit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import { useAccount } from "wagmi";
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
        <Liquity2Info />
        <StabilityPool />
        <AccountDetails />
        <TroveDetails ownerIndex={0n} />
        <TroveDetails ownerIndex={1n} />
        <TroveDetails ownerIndex={2n} />
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
  const { address } = useAccount();

  const {
    ethBalance,
    boldBalance,
    collBalance,
    status: accountBalancesStatus,
  } = useAccountBalances(address);

  const tapCollTokenFaucet = useTapCollTokenFaucet();

  return (
    <Card
      title="Account"
      action={match({ address })
        .with({ address: P.string }, () => ({
          label: "Get WETH",
          onClick: tapCollTokenFaucet,
        }))
        .otherwise(() => ({
          label: "Connect Wallet",
          onClick: () => setOpen(true),
        }))}
    >
      {match({ address, ethBalance, boldBalance, collBalance, accountBalancesStatus })
        .when(
          ({ address, accountBalancesStatus }) => address && accountBalancesStatus === "pending",
          () => <div>loading…</div>,
        )
        .when(
          ({ address, accountBalancesStatus }) => address && accountBalancesStatus === "error",
          () => <div>error</div>,
        )
        .with(
          {
            address: P.string,
            accountBalancesStatus: "success",
          },
          ({
            address,
            ethBalance,
            boldBalance,
            collBalance,
          }) => (
            <>
              <CardRow
                name="Address"
                value={<span title={address}>{shortenAddress(address, 4)}</span>}
              />
              <CardRow
                name="ETH Balance"
                value={
                  <span title={ethBalance && dn.format(ethBalance)}>
                    {ethBalance && dn.format(ethBalance, 2)} ETH
                  </span>
                }
              />
              <CardRow
                name="WETH Balance"
                value={
                  <span title={collBalance && dn.format(collBalance)}>
                    {collBalance && dn.format(collBalance, 2)} WETH
                  </span>
                }
              />
              <CardRow
                name="BOLD Balance"
                value={
                  <span title={boldBalance && dn.format(boldBalance)}>
                    {boldBalance && dn.format(boldBalance, 2)} BOLD
                  </span>
                }
              />
            </>
          ),
        )
        .otherwise(() => null)}
    </Card>
  );
}

function TroveDetails({ ownerIndex }: { ownerIndex: bigint }) {
  const { address } = useAccount();
  const troveDetails = useTroveDetails(address && getTroveId(address, ownerIndex));

  const closeTrove = useCloseTrove(getTroveId(address ?? ADDRESS_ZERO, ownerIndex));
  const openTrove = useOpenTrove(address ?? ADDRESS_ZERO, {
    ownerIndex,
    maxFeePercentage: 100n * 10n ** 16n, // 100%
    boldAmount: 1800n * 10n ** 18n, // 1800 BOLD
    upperHint: 0n,
    lowerHint: 0n,
    interestRate: 5n * 10n ** 16n, // 5%
    ethAmount: 20n * 10n ** 18n, // 20 ETH
  });

  return (
    <Card
      title={`Trove #${ownerIndex}`}
      action={match([troveDetails.data?.status, address])
        .with(
          [
            P.union(
              "nonExistent",
              "closedByOwner",
              "closedByRedemption",
              "closedByLiquidation",
            ),
            P.not(undefined),
          ],
          () => ({
            label: `Open Trove #${ownerIndex}`,
            onClick: openTrove,
          }),
        )
        .with(["active", P.not(undefined)], () => ({
          label: `Close Trove #${ownerIndex}`,
          onClick: () => {
            const data = closeTrove();
            console.log("closeTrove", data);
          },
        }))
        .otherwise(() => null)}
    >
      {match([troveDetails, address])
        .with([{ status: "pending" }, P.not(undefined)], () => "loading…")
        .with([{ status: "error" }, P.not(undefined)], () => "error")
        .with([{ status: "success", data: P.not(undefined) }, P.not(undefined)], ([{ data }]) => (
          <>
            <CardRow name="Status" value={data.status} />
            <CardRow name="Stake" value={dn.format(data.stake) + " ETH"} />
            <CardRow name="Debt" value={dn.format(data.debt) + " BOLD"} />
            <CardRow name="Collateral" value={dn.format(data.collateral) + " ETH"} />
            <CardRow name="Interest Rate" value={dn.format(dn.mul(data.interestRate, 100)) + "%"} />
          </>
        ))
        .otherwise(() => null)}
    </Card>
  );
}

function StabilityPool() {
  const stats = useStabilityPoolStats();
  return (
    <Card title="Stability Pool">
      {match(stats)
        .with({ status: "error" }, () => "error")
        .with({ status: "pending" }, () => "loading…")
        .with({ status: "success" }, ({ data }) => (
          <>
            <CardRow
              name="Total Deposits"
              value={dn.format(data.totalBoldDeposits, 2) + " BOLD"}
            />
            <CardRow
              name="ETH Balance"
              value={dn.format(data.ethBalance, 2) + " ETH"}
            />
          </>
        ))
        .otherwise(() => null)}
    </Card>
  );
}

function Liquity2Info() {
  const liquity2Info = useLiquity2Info();
  return (
    <Card title="Liquity v2 Stats">
      {match(liquity2Info)
        .with({ status: "error" }, () => "error")
        .with({ status: "pending" }, () => "loading…")
        .with({ status: "success" }, ({ data }) => (
          <>
            <CardRow
              name="Troves Count"
              value="?"
            />
            <CardRow
              name="Total Collateral"
              value={dn.format(data.totalCollateral) + " ETH"}
            />
            <CardRow
              name="Total Debt"
              value={dn.format(data.totalDebt, 2) + " BOLD"}
            />
            <CardRow
              name={
                <>
                  <abbr title="Total Collateral Ratio">TCR</abbr> ($200/ETH)
                </>
              }
              value={dn.format(dn.mul(data.tcr, 100n), 2) + "%"}
            />
            <CardRow
              name="Redemption Rate"
              value={dn.format(dn.mul(data.redemptionRate, 100n), 2) + "%"}
            />
            <CardRow
              name="Stability Pool Deposits"
              value={dn.format(data.totalBoldDeposits, 2) + " BOLD"}
            />
          </>
        ))
        .otherwise(() => null)}
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
  action?: null | {
    label: string;
    onClick: () => void;
  };
  children: ReactNode;
  title: string;
}) {
  return (
    <div
      className={css({
        height: 400,
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
          flexGrow: 1,
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
        <div>
          {children}
        </div>
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
                translate: "0 1px",
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

function CardRow({
  name,
  value,
}: {
  name: ReactNode;
  value: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 80,
        height: 32,
        whiteSpace: "nowrap",
      })}
    >
      <div>
        {name}
      </div>
      <div>{value}</div>
    </div>
  );
}
