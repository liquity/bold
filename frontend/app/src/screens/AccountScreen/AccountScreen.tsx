"use client";

import type { Address, TokenSymbol } from "@/src/types";
import type { ReactNode } from "react";

import { ERC20Faucet } from "@/src/abi/ERC20Faucet";
import { Positions } from "@/src/comps/Positions/Positions";
import { Screen } from "@/src/comps/Screen/Screen";
import { getCollateralContract, getContracts, getProtocolContract } from "@/src/contracts";
import { fmtnum } from "@/src/formatting";
import { useBalance } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { Button, IconAccount, isCollateralSymbol, shortenAddress, TokenIcon, VFlex } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import { useWriteContract } from "wagmi";

export function AccountScreen({
  address,
}: {
  address: Address;
}) {
  const collSymbols = getContracts().collaterals.map((coll) => coll.symbol);
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
            title={address}
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 12,
              height: 40,
              fontSize: 40,
            })}
          >
            {shortenAddress(address, 3)}
            <Image
              alt=""
              width={32}
              height={32}
              src={blo(address)}
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
              gridTemplateColumns: `repeat(3, 1fr)`,
            }}
          >
            <GridItem label="BOLD balance">
              <Balance
                address={address}
                tokenSymbol="BOLD"
              />
            </GridItem>
            <GridItem label="LQTY balance">
              <Balance
                address={address}
                tokenSymbol="LQTY"
                tapButton
              />
            </GridItem>
            {collSymbols.map((symbol) => (
              <GridItem
                key={symbol}
                label={`${symbol} balance`}
              >
                <Balance
                  address={address}
                  tokenSymbol={symbol}
                  tapButton={symbol !== "ETH"}
                />
              </GridItem>
            ))}
          </div>
        </section>
        <Positions
          address={address}
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

  const LqtyToken = getProtocolContract("LqtyToken");
  const CollToken = getCollateralContract(
    isCollateralSymbol(tokenSymbol) ? tokenSymbol : null,
    "CollToken",
  );

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
            if ((tokenSymbol === "WSTETH" || tokenSymbol === "RETH") && CollToken) {
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
              return;
            }

            if (tokenSymbol === "LQTY") {
              writeContract({
                abi: LqtyToken.abi,
                address: LqtyToken.address,
                functionName: "mint",
                args: [100n * 10n ** 18n],
              }, {
                onError: (error) => {
                  alert(error.message);
                },
              });
              return;
            }
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
