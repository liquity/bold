"use client";

import type { Address, TokenSymbol } from "@/src/types";
import type { ReactNode } from "react";

import { ERC20Faucet } from "@/src/abi/ERC20Faucet";
import { Positions } from "@/src/comps/Positions/Positions";
import { Screen } from "@/src/comps/Screen/Screen";
import { getBranchContract, getProtocolContract } from "@/src/contracts";
import { CHAIN_ID } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { getBranches } from "@/src/liquity-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  addressesEqual,
  Button,
  IconAccount,
  isCollateralSymbol,
  shortenAddress,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import { useWriteContract } from "wagmi";

export function AccountScreen({
  address,
}: {
  address: Address;
}) {
  const account = useAccount();
  const branches = getBranches();
  const tapEnabled = CHAIN_ID !== 1;
  return (
    <Screen>
      <VFlex gap={32}>
        <h1
          className={css({
            fontSize: 32,
            userSelect: "none",
            color: "content",
          })}
        >
          Account
        </h1>
        <section
          className={css({
            padding: "16px 16px 24px",
            color: "controlSurface",
            background: "infoSurface",
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
              color: "contentAlt"
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "contentAlt",
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
              color: "content",
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
            <GridItem label="bvUSD balance">
              <Balance
                address={address}
                tokenSymbol="bvUSD"
              />
            </GridItem>
            <GridItem label="VCRAFT balance">
              <Balance
                address={address}
                tokenSymbol="bvUSD"
                tapButton={tapEnabled
                  && account.address
                  && addressesEqual(address, account.address)}
              />
            </GridItem>
            {branches.map(({ symbol }) => (
              <GridItem
                key={symbol}
                label={`${symbol} balance`}
              >
                <Balance
                  address={address}
                  tokenSymbol={symbol}
                  tapButton={tapEnabled
                    && symbol !== "ETH" && account.address
                    && addressesEqual(address, account.address)}
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
  const CollToken = getBranchContract(
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
