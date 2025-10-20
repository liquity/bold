"use client";

import type { TokenSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Logo } from "@/src/comps/Logo/Logo";
import { ACCOUNT_SCREEN } from "@/src/env";
import { useAccount } from "@/src/services/Arbitrum";
import { useLandingPageStats } from "@/src/services/LandingPageStats";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import {
  AnchorTextButton,
  HFlex,
  IconDiscord,
  IconExternal,
  IconX,
  shortenAddress,
  TokenIcon,
} from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";
import Link from "next/link";
import * as dn from "dnum";

const DISPLAYED_PRICES = ["USND", "ETH"] as const;

export function ProtocolStats() {
  const account = useAccount();
  const landingStats = useLandingPageStats();
  const { showYusndPrice, isLoading: isCheckingYusnd, handleAddYusndToWallet } = landingStats.yusndStatus;

  return (
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
        <HFlex gap={16} alignItems='center'>
          <HFlex gap={4} alignItems='center'>
            <Logo />
            <span>TVL</span>{" "}
            <span>
              {landingStats.isLoading ? '…' : 
              landingStats.error ? 'Error' :
              landingStats.tvl ? (
                <Amount fallback='…' format='compact' prefix='$' value={landingStats.tvl} />
              ) : '…'}
            </span>
          </HFlex>
          <HFlex gap={4} alignItems='center'>
            <span>SP APR</span>{" "}
            <span>
              {landingStats.stabilityPoolAPR ? (
                // <Amount fallback='…' format='2z' suffix='%' value={[BigInt(Math.round(landingStats.stabilityPoolAPR * 100 * 1e18)), 18]} />
                <Amount fallback='…' format='2z' suffix='%' value={dn.mul(landingStats.stabilityPoolAPR, 100)} />
              ) : (
                '…'
              )}
            </span>
          </HFlex>
          {/* <HFlex gap={4} alignItems='center'>
            <span>Vaults</span>{" "}
            <span>
              {landingStats.vaultCount ? (
                landingStats.vaultCount.toLocaleString()
              ) : (
                '…'
              )}
            </span>
          </HFlex> */}
          {/* <HFlex gap={4} alignItems='center'>
            <span>Go Slow NFTs</span>{" "}
            <span>
              {landingStats.isLoading ? '...' : 
              landingStats.goSlowNFTCount !== null ? (
                landingStats.goSlowNFTCount.toLocaleString()
              ) : '...'}
            </span>
          </HFlex> */}
        </HFlex>
        <HFlex gap={16}>
          {DISPLAYED_PRICES.map((symbol) => (
            <Price key={symbol} symbol={symbol} />
          ))}
          {!isCheckingYusnd && showYusndPrice ? (
            <Price symbol="YUSND" />
          ) : (
            <button
              onClick={handleAddYusndToWallet}
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontSize: 12,
                color: "content",
                background: "transparent",
                border: "1px solid token(colors.tableBorder)",
                borderRadius: 4,
                cursor: "pointer",
                _hover: {
                  opacity: 0.8,
                  background: "token(colors.secondary)"
                },
                _focusVisible: {
                  outline: "2px solid token(colors.focused)",
                },
                _active: {
                  translate: "0 1px",
                },
              })}
              title="Add yUSND to wallet"
            >
              <TokenIcon size={16} symbol="YUSND" title="Yield-bearing USND optimized by Yearn." />
              <span>yUSND</span>
              <span style={{ fontSize: 10 }}>+</span>
            </button>
          )}
          <Link
            href='https://discord.gg/5h3avBYxcn'
            target='_blank'
            rel='noopener noreferrer'
            className={css({
              display: "flex",
              alignItems: "center",
              color: "content",
              _hover: { opacity: 0.8 },
              _focusVisible: {
                outline: "2px solid token(colors.focused)",
              },
              _active: {
                translate: "0 1px",
              },
            })}
          >
            <IconDiscord size={16} />
          </Link>
          <Link
            href='https://x.com/neriteorg'
            target='_blank'
            rel='noopener noreferrer'
            className={css({
              display: "flex",
              alignItems: "center",
              color: "content",
              _hover: { opacity: 0.8 },
              _focusVisible: {
                outline: "2px solid token(colors.focused)",
              },
              _active: {
                translate: "0 1px",
              },
            })}
          >
            <IconX size={16} />
          </Link>
          <Link
            href='https://docs.nerite.org/'
            target='_blank'
            rel='noopener noreferrer'
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
              color: "content",
              _hover: { opacity: 0.8 },
              _focusVisible: {
                outline: "2px solid token(colors.focused)",
              },
              _active: {
                translate: "0 1px",
              },
            })}
          >
            <IconExternal size={16} />
            <span>Docs</span>
          </Link>
          {account.address && ACCOUNT_SCREEN && (
            <Link
              id='footer-account-button'
              href={`/account?address=${account.address}`}
              passHref
              legacyBehavior
              scroll={true}
            >
              <AnchorTextButton
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
        </HFlex>
      </div>
    </div>
  );
}

function Price({ symbol }: { symbol: TokenSymbol }) {
  if (symbol === "SHELL") return null;
  const price = usePrice(symbol === "YUSND" ? "USND" : symbol);
  return (
    <HFlex key={symbol} gap={4}>
      <TokenIcon size={16} symbol={symbol} />
      <HFlex gap={8}>
        <span>{symbol}</span>
        <Amount prefix='$' fallback='…' value={price.data} format='2z' />
      </HFlex>
    </HFlex>
  );
}
