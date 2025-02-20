"use client";

import type { TokenSymbol } from "@/src/types";

import { useAbout } from "@/src/comps/About/About";
import { Amount } from "@/src/comps/Amount/Amount";
import { Logo } from "@/src/comps/Logo/Logo";
import { ACCOUNT_SCREEN } from "@/src/env";
import { useLiquityStats } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { AnchorTextButton, HFlex, shortenAddress, TextButton, TokenIcon } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import Link from "next/link";

const DISPLAYED_PRICES = ["LQTY", "BOLD", "ETH"] as const;

export function BottomBar() {
  const account = useAccount();
  const stats = useLiquityStats();

  const tvl = stats.data?.totalValueLocked;

  return (
    <div
      className={css({
        width: "100%",
        padding: "0 24px",
      })}
    >
      <BuildInfo />
      <div
        className={css({
          display: "flex",
          width: "100%",
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
          <HFlex gap={4} alignItems="center">
            <Logo size={16} />
            <span>TVL</span>{" "}
            <span>
              {tvl && (
                <Amount
                  fallback="…"
                  format="compact"
                  prefix="$"
                  value={tvl}
                />
              )}
            </span>
          </HFlex>
          <HFlex gap={16}>
            {DISPLAYED_PRICES.map((symbol) => (
              <Price
                key={symbol}
                symbol={symbol}
              />
            ))}
            {account.address && ACCOUNT_SCREEN && (
              <Link
                id="footer-account-button"
                href={`/account?address=${account.address}`}
                passHref
                legacyBehavior
                scroll={true}
              >
                <AnchorTextButton
                  label={
                    <HFlex gap={4} alignItems="center">
                      <Image
                        alt=""
                        width={16}
                        height={16}
                        src={blo(account.address)}
                        className={css({
                          borderRadius: "50%",
                        })}
                      />

                      {shortenAddress(account.address, 3)}
                    </HFlex>
                  }
                  className={css({
                    color: "content",
                    borderRadius: 4,
                    _focusVisible: {
                      outline: "2px solid token(colors.focused)",
                    },
                    _active: {
                      translate: "0 1px",
                    },
                  })}
                />
              </Link>
            )}
            <Link
              id="footer-redeem-button"
              href="/redeem"
              passHref
              legacyBehavior
              scroll={true}
            >
              <AnchorTextButton
                label={
                  <HFlex gap={4} alignItems="center">
                    <TokenIcon
                      size={16}
                      symbol="BOLD"
                    />
                    Redeem BOLD
                  </HFlex>
                }
                className={css({
                  color: "content",
                  borderRadius: 4,
                  _focusVisible: {
                    outline: "2px solid token(colors.focused)",
                  },
                  _active: {
                    translate: "0 1px",
                  },
                })}
              />
            </Link>
          </HFlex>
        </div>
      </div>
    </div>
  );
}

function Price({ symbol }: { symbol: TokenSymbol }) {
  const price = usePrice(symbol);
  return (
    <HFlex
      key={symbol}
      gap={4}
    >
      <TokenIcon
        size={16}
        symbol={symbol}
      />
      <HFlex gap={8}>
        <span>{symbol}</span>
        <Amount
          prefix="$"
          fallback="…"
          value={price.data}
          format="2z"
        />
      </HFlex>
    </HFlex>
  );
}

function BuildInfo() {
  const about = useAbout();
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        height: 40,
      })}
    >
      <TextButton
        label={about.fullVersion}
        title={`About Liquity V2 App ${about.fullVersion}`}
        onClick={() => {
          about.openModal();
        }}
        className={css({
          color: "dimmed",
        })}
        style={{
          fontSize: 12,
        }}
      />
    </div>
  );
}
