"use client";

import type { Address, TokenSymbol } from "@/src/types";
import type { ReactNode } from "react";

import { ERC20Faucet } from "@/src/abi/ERC20Faucet";
import { Positions } from "@/src/comps/Positions/Positions";
import { Screen } from "@/src/comps/Screen/Screen";
import { useCollateralContracts } from "@/src/contracts";
import { isAddress, shortenAddress } from "@/src/eth-utils";
import { fmtnum } from "@/src/formatting";
import { useBalance } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { Button, IconAccount, TokenIcon, VFlex } from "@liquity2/uikit";
import { blo } from "blo";
import { notFound, useSearchParams } from "next/navigation";
import { useWriteContract } from "wagmi";

export default function Page() {
  const searchParams = useSearchParams();
  const accountAddress = searchParams.get("a");

  if (!isAddress(accountAddress)) {
    notFound();
  }

  const collSymbols = useCollateralContracts().map((coll) => coll.symbol);

  return (
    <Screen>
      <VFlex gap={32}>
        <h1
          className={css({
            fontSize: 32,
            userSelect: "none",
          })}
        >
          Account
        </h1>
        <section
          className={css({
            padding: "16px 16px 24px",
            color: "strongSurfaceContent",
            background: "strongSurface",
            borderRadius: 8,
            userSelect: "none",
          })}
        >
          <h1
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingBottom: 12,
              textTransform: "uppercase",
              fontSize: 12,
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt2",
              })}
            >
              <IconAccount size={16} />
            </div>
            Account
          </h1>
          <div
            title={accountAddress}
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 12,
              height: 40,
              fontSize: 40,
            })}
          >
            {shortenAddress(accountAddress, 3)}
            <img
              src={blo(accountAddress)}
              alt=""
              className={css({
                width: 32,
                height: "auto",
                borderRadius: 8,
              })}
            />
          </div>
          <div
            className={css({
              display: "grid",
              gap: 12,
              paddingTop: 32,
            })}
            style={{
              gridTemplateColumns: `repeat(${collSymbols.length + 1}, 1fr)`,
            }}
          >
            <GridItem label="BOLD balance">
              <Balance
                address={accountAddress}
                tokenSymbol="BOLD"
              />
            </GridItem>
            {collSymbols.map((symbol) => (
              <GridItem
                key={symbol}
                label={`${symbol} balance`}
              >
                <Balance
                  address={accountAddress}
                  tokenSymbol={symbol}
                  tapButton={symbol !== "ETH"}
                />
              </GridItem>
            ))}
          </div>
        </section>
        <Positions
          address={accountAddress}
          columns={1}
          title={(mode) => mode === "actions" ? null : "Positions"}
          showNewPositionCard={false}
        />
      </VFlex>
    </Screen>
  );
}

function Balance({
  address,
  tapButton,
  tokenSymbol,
}: {
  address: Address;
  tapButton?: boolean;
  tokenSymbol: TokenSymbol;
}) {
  const balance = useBalance(address, tokenSymbol);

  const CollToken = useCollateralContracts()
    .find((coll) => coll.symbol === tokenSymbol)
    ?.contracts.CollToken;

  const { writeContract } = useWriteContract();

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
      })}
    >
      <div
        title={`${fmtnum(balance.data, "full")} ${tokenSymbol}`}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 4,
        })}
      >
        {fmtnum(balance.data, 2) || "−"}
        <TokenIcon symbol={tokenSymbol} size="mini" />
      </div>
      {tapButton && (
        <Button
          mode="primary"
          size="mini"
          label="tap"
          onClick={() => {
            if (!CollToken) {
              return;
            }

            writeContract({
              abi: ERC20Faucet,
              address: CollToken.address,
              functionName: "tap",
              args: [],
            }, {
              onError: (error) => {
                alert(error.message);
              },
            });
          }}
          style={{
            padding: "0 6px",
            height: 20,
            fontSize: 11,
            textTransform: "uppercase",
          }}
        />
      )}
    </div>
  );
}

function GridItem({
  children,
  label,
  title,
}: {
  children: ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 14,
      })}
    >
      <div
        title={title}
        className={css({
          color: "strongSurfaceContentAlt",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          whiteSpace: "nowrap",
          color: "strongSurfaceContent",
        })}
      >
        {children}
      </div>
    </div>
  );
}
