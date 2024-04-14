"use client";

import type { ReactNode } from "react";

import { ADDRESS_ZERO, shortenAddress } from "@/src/eth-utils";
import {
  getTroveId,
  useAccountBalances,
  useCloseTrove,
  useCollTokenAllowance,
  useOpenTrove,
  useStabilityPoolStats,
  useTapCollTokenFaucet,
  useTroveDetails,
  useTrovesStats,
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
        paddingTop: 80,
      })}
    >
      <h1
        className={css({
          fontSize: 40,
        })}
      >
        Liquity v2
      </h1>
      <CardsGrid>
        <LiquityStats />
        <TrovesStats />
        <StabilityPool />
        <AccountDetails />
        <TroveDetails ownerIndex={0n} />
        <TroveDetails ownerIndex={1n} />
        <TroveDetails ownerIndex={2n} />
        <TroveDetails ownerIndex={3n} />
        <TroveDetails ownerIndex={4n} />
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

  const { allowance, approve } = useCollTokenAllowance();
  const isApproved = allowance.data ?? 0n > 0n;

  return (
    <Card
      title="Account"
      action={match({ address })
        .with({ address: P.string }, () => {
          const getWethAction = {
            label: "Receive WETH",
            onClick: tapCollTokenFaucet,
          };
          return isApproved ? getWethAction : [
            {
              label: "Approve ∞",
              title: "Approve Liquity to transfer WETH on your behalf",
              onClick: () => {
                approve();
              },
            },
            getWethAction,
          ];
        })
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

const openTroveQuickParams = {
  maxFeePercentage: 100n * 10n ** 16n, // 100%
  boldAmount: 1800n * 10n ** 18n, // 1800 BOLD
  upperHint: 0n,
  lowerHint: 0n,
  interestRate: 5n * 10n ** 16n, // 5%
  ethAmount: 20n * 10n ** 18n, // 20 ETH
};

function TroveDetails({ ownerIndex }: { ownerIndex: bigint }) {
  const { address } = useAccount();
  const troveDetails = useTroveDetails(address && getTroveId(address, ownerIndex));

  const closeTrove = useCloseTrove(getTroveId(address ?? ADDRESS_ZERO, ownerIndex));
  const openTrove = useOpenTrove(address ?? ADDRESS_ZERO, {
    ownerIndex,
    ...openTroveQuickParams,
  });

  const { allowance } = useCollTokenAllowance();
  const isApproved = (allowance.data ?? 0n) >= openTroveQuickParams.ethAmount;

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
            disabled: isApproved ? null : "Please approve first",
            label: `Open Trove #${ownerIndex}`,
            onClick: () => {
              if (isApproved) {
                openTrove();
              }
            },
          }),
        )
        .with(["active", P.not(undefined)], () => ({
          label: `Close Trove #${ownerIndex}`,
          onClick: () => {
            closeTrove();
          },
        }))
        .otherwise(() => null)}
    >
      {match([troveDetails, address])
        .with([P.any, P.nullish], () => "please connect")
        .with([{ status: "pending" }, P.any], () => "loading…")
        .with([{ status: "error" }, P.any], () => "error")
        .with(
          [{ status: "success", data: { status: P.not("active") } }, P.any],
          ([{ data }]) => (
            <>
              <CardRow name="Status" value={data.status} />
              <CardRow name="Stake" value="−" />
              <CardRow name="Debt" value="−" />
              <CardRow name="Collateral" value="−" />
              <CardRow name="Interest Rate" value="−" />
            </>
          ),
        )
        .with(
          [{ status: "success", data: P.not(undefined) }, P.any],
          ([{ data }]) => (
            <>
              <CardRow name="Status" value={data.status} />
              <CardRow name="Stake" value={dn.format(data.stake) + " ETH"} />
              <CardRow name="Debt" value={dn.format(data.debt) + " BOLD"} />
              <CardRow name="Collateral" value={dn.format(data.collateral) + " ETH"} />
              <CardRow name="Interest Rate" value={dn.format(dn.mul(data.interestRate, 100)) + "%"} />
            </>
          ),
        )
        .otherwise(() => null)}
    </Card>
  );
}

function StabilityPool() {
  const stats = useStabilityPoolStats();
  return (
    <Card title="Stability Pool" solid={false}>
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

function LiquityStats() {
  const stats = useTrovesStats();
  return (
    <Card title="Protocol" solid={false}>
      {match(stats)
        .with({ status: "error" }, () => "error")
        .with({ status: "pending" }, () => "loading…")
        .with({ status: "success" }, ({
          data: { redemptionRate, recoveryMode, tcr },
        }) => (
          <>
            <CardRow
              name={
                <>
                  <abbr title="Total Collateral Ratio">TCR</abbr> ($200/ETH)
                </>
              }
              value={dn.format(dn.mul(tcr, 100n), 2) + "%"}
            />
            <CardRow
              name="Redemption Rate"
              value={dn.format(dn.mul(redemptionRate, 100n), 2) + "%"}
            />
            <CardRow
              name="Recovery Mode"
              value={recoveryMode ? "Yes" : "No"}
            />
          </>
        ))
        .otherwise(() => null)}
    </Card>
  );
}

function TrovesStats() {
  const stats = useTrovesStats();
  return (
    <Card title="Troves" solid={false}>
      {match(stats)
        .with({ status: "error" }, () => "error")
        .with({ status: "pending" }, () => "loading…")
        .with({ status: "success" }, ({
          data: {
            totalCollateral,
            totalDebt,
            trovesCount,
          },
        }) => (
          <>
            <CardRow
              name="Active Troves"
              value={trovesCount}
            />
            <CardRow
              name="Total Collateral"
              value={dn.format(totalCollateral) + " ETH"}
            />
            <CardRow
              name="Total Debt"
              value={dn.format(totalDebt, 2) + " BOLD"}
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
        padding: "40px 0 80px",
      })}
    >
      {children}
    </div>
  );
}

type CardAction = {
  label: string;
  disabled?: string; // disabled message
  onClick: () => void;
  title?: string;
};

function Card({
  action,
  children,
  title,
  solid = true,
}: {
  solid?: boolean;
  action?: null | CardAction | CardAction[];
  children: ReactNode;
  title: string;
}) {
  const actions = Array.isArray(action)
    ? action
    : (action ? [action] : []);
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 40,
        minHeight: 214,
        padding: solid ? 32 : "40px 0",
      })}
      style={{
        background: solid ? "#F7F7FF" : "transparent",
      }}
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
            gap: 16,
          })}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.disabled ? undefined : action.onClick}
              title={action.disabled ?? action.title}
              disabled={Boolean(action.disabled)}
              className={css({
                height: 40,
                padding: "8px 16px",
                color: "white",
                fontSize: 14,
                background: "blue",
                borderRadius: 16,
                cursor: "pointer",
                whiteSpace: "nowrap",
                _disabled: {
                  background: "rain",
                  cursor: "not-allowed",
                },
                _active: {
                  _enabled: {
                    translate: "0 1px",
                  },
                },
              })}
            >
              {action.label}
            </button>
          ))}
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
