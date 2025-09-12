import type { Address, TokenSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Logo } from "@/src/comps/Logo/Logo";
import { ACCOUNT_SCREEN, CHAIN_BLOCK_EXPLORER, CONTRACT_BOLD_TOKEN, CONTRACT_LQTY_TOKEN } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { useLiquityStats } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { shortenAddress, TokenIcon } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import { AboutButton } from "./AboutButton";

const DISPLAYED_PRICES = ["LQTY", "BOLD", "ETH"] as const;
const ENABLE_REDEEM = false;

export function BottomBar() {
  const account = useAccount();
  const stats = useLiquityStats();

  const tvl = stats.data?.totalValueLocked;
  const boldSupply = stats.data?.totalBoldSupply;

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
          paddingRight: {
            base: 16,
            medium: 0,
          },
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
              gap: 16,
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
            <div
              title={`Total supply: ${
                fmtnum(boldSupply, {
                  suffix: " BOLD",
                  preset: "2z",
                })
              }`}
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              })}
            >
              <div
                className={css({
                  flexShrink: 0,
                })}
              >
                <TokenIcon
                  title={null}
                  symbol="BOLD"
                  size={16}
                />
              </div>
              <span>
                {boldSupply && (
                  <Amount
                    title={null}
                    fallback="…"
                    format="compact"
                    value={boldSupply}
                    suffix=" BOLD"
                  />
                )}
              </span>
            </div>
            {ENABLE_REDEEM && (
              <LinkTextButton
                id="footer-redeem-button"
                href="/redeem"
                label={
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                    })}
                  >
                    Redeem BOLD
                  </div>
                }
                className={css({
                  color: "content",
                  borderRadius: 4,
                  _focusVisible: { outline: "2px solid token(colors.focused)" },
                  _active: { translate: "0 1px" },
                })}
              />
            )}
          </div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 16,
            })}
          >
            {DISPLAYED_PRICES.map((symbol) => (
              <Price
                key={symbol}
                symbol={symbol}
              />
            ))}
            {account.address && ACCOUNT_SCREEN && (
              <LinkTextButton
                id="footer-account-button"
                href={`/account?address=${account.address}`}
                label={
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
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
                  </div>
                }
                className={css({
                  color: "content",
                  whiteSpace: "nowrap",
                })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTokenAddress(symbol: TokenSymbol) {
  if (symbol === "LQTY") {
    return CONTRACT_LQTY_TOKEN;
  }
  if (symbol === "BOLD") {
    return CONTRACT_BOLD_TOKEN;
  }
  return null;
}

function getTokenLink(address: Address) {
  if (!CHAIN_BLOCK_EXPLORER) {
    return null;
  }
  return address && `${CHAIN_BLOCK_EXPLORER.url}token/${address}`;
}

function Price({ symbol }: { symbol: Exclude<TokenSymbol, "SBOLD"> }) {
  const price = usePrice(symbol);
  const tokenAddress = getTokenAddress(symbol);
  const tokenUrl = tokenAddress && getTokenLink(tokenAddress);
  const token = (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 4,
      })}
    >
      <TokenIcon
        size={16}
        symbol={symbol}
        title={null}
      />
      <span>{symbol}</span>
    </div>
  );
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
      })}
    >
      {tokenUrl
        ? (
          <LinkTextButton
            title={`${symbol}: ${tokenAddress}`}
            external
            href={tokenUrl}
            label={token}
            className={css({
              color: "content!",
              _hover: {
                textDecoration: "underline",
              },
              _focusVisible: {
                outline: "2px solid token(colors.focused)",
              },
              _active: {
                translate: "0 1px",
              },
            })}
          />
        )
        : token}
      <Amount
        prefix="$"
        fallback="…"
        value={price.data}
        format="2z"
      />
    </div>
  );
}
