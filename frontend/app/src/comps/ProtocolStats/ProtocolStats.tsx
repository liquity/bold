"use client";

import { Amount } from "@/src/comps/Amount/Amount";
import { Logo } from "@/src/comps/Logo/Logo";
import { getContracts } from "@/src/contracts";
import { useAccount } from "@/src/services/Arbitrum";
import { useAllPrices } from "@/src/services/Prices";
import { useTotalDeposited } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import {
  AnchorTextButton,
  HFlex,
  shortenAddress,
  TokenIcon,
} from "@liquity2/uikit";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";

const DISPLAYED_PRICES = ["USDN", "ETH"] as const;

export function ProtocolStats() {
  const account = useAccount();
  const prices = useAllPrices();
  const totalDeposited = useTotalDeposited();

  const tvl = getContracts()
    .collaterals.map((collateral, collIndex) => {
      const price = prices[collateral.symbol];
      const deposited = totalDeposited.data?.[collIndex].totalDeposited;
      return price && deposited && dn.mul(price, deposited);
    })
    .reduce((a, b) => (b ? dn.add(a ?? dn.from(0, 18), b) : a), null);

  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
        padding: "0 24px",
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          height: 48,
          fontSize: 12,
          borderTop: "1px solid token(colors.tableBorder)",
          userSelect: "none",
        })}
      >
        <HFlex gap={4} alignItems='center'>
          <Logo size={26} />
          <span>TVL</span>{" "}
          <span>
            <Amount fallback='…' format='compact' prefix='$' value={tvl} />
          </span>
        </HFlex>
        <HFlex gap={16}>
          {DISPLAYED_PRICES.map((symbol) => {
            const price = prices[symbol];
            return (
              <HFlex key={symbol} gap={4}>
                <TokenIcon size={16} symbol={symbol} />
                <HFlex gap={8}>
                  <span>{symbol}</span>
                  <Amount prefix='$' fallback='…' value={price} format='2z' />
                </HFlex>
              </HFlex>
            );
          })}
          {account.address && (
            <AnchorTextButton
              id='footer-account-button'
              href={`/account?address=${account.address}`}
              label={
                <HFlex gap={4} alignItems='center'>
                  <Image
                    alt=''
                    width={16}
                    height={16}
                    src={blo(account.address)}
                    className={css({
                      borderRadius: "50%",
                    })}
                  />

                  <HFlex gap={8}>
                    <span>{shortenAddress(account.address, 3)}</span>
                  </HFlex>
                </HFlex>
              }
              className={css({
                color: "content",
              })}
            />
          )}
        </HFlex>
      </div>
    </div>
  );
}
