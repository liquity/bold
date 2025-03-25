import type { TokenSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Logo } from "@/src/comps/Logo/Logo";
import { ACCOUNT_SCREEN } from "@/src/env";
import { useLiquityStats } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { AnchorTextButton, HFlex, shortenAddress, TokenIcon } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import Link from "next/link";
import { AboutButton } from "./AboutButton";

const DISPLAYED_PRICES = ["LQTY", "BOLD", "ETH"] as const;

export function BottomBar() {
  const account = useAccount();
  const stats = useLiquityStats();

  const tvl = stats.data?.totalValueLocked;

  return (
    <div
      className={css({
        overflow: "hidden",
        width: "100%",
        padding: {
          base: 0,
          medium: "0 24px",
        },
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          height: 40,
          hideBelow: "medium",
        })}
      >
        <AboutButton />
      </div>
      <div
        className={css({
          display: "flex",
          width: "100%",
        })}
      >
        <div
          className={css({
            overflowX: "auto",
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            width: "100%",
            maxWidth: "100%",
            height: 48,
            paddingLeft: {
              base: 12,
              medium: 0,
            },
            fontSize: 12,
            borderTop: "1px solid token(colors.tableBorder)",
            userSelect: "none",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
            })}
          >
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
          </div>
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
                    whiteSpace: "nowrap",
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
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                    })}
                  >
                    <TokenIcon
                      size={16}
                      symbol="BOLD"
                    />
                    Redeem BOLD
                  </div>
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
