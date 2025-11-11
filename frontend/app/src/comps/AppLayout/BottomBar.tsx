"use client";

import { Amount } from "@/src/comps/Amount/Amount";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import Image from "next/image";
import Link from "next/link";
import XIcon from "@/src/assets/x.svg";
import DiscordIcon from "@/src/assets/discord.svg";
import MustIcon from "@/src/assets/must.svg";
import SagaIcon from "@/src/assets/saga.png";

export function BottomBar() {
  const sagaPrice = usePrice("SAGA");
  
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
          width: "100%",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            height: 48,
            paddingLeft: {
              base: 12,
              medium: 0,
            },
            paddingRight: {
              base: 12,
              medium: 0,
            },
            fontSize: 12,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
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
                color: "rgba(255, 255, 255, 0.7)",
              })}
            >
              <Image src={MustIcon} alt="MUST" width={16} height={16} />
              <span className={css({ hideBelow: "medium" })}>MUST</span>
              <span>$1.00</span>
            </div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "rgba(255, 255, 255, 0.7)",
              })}
            >
              <Image src={SagaIcon} alt="SAGA" width={16} height={16} />
              <span className={css({ hideBelow: "medium" })}>SAGA</span>
              <Amount prefix="$" fallback="…" value={sagaPrice.data} format={3} />
            </div>
            <Link
              href="https://discord.com/invite/UCRsTy82Ub"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                display: "flex",
                alignItems: "center",
                color: "rgba(255, 255, 255, 0.7)",
                _hover: { 
                  color: "white",
                },
                _focusVisible: {
                  outline: "2px solid rgba(255, 255, 255, 0.5)",
                },
                _active: {
                  translate: "0 1px",
                },
              })}
            >
              <Image src={DiscordIcon} alt="Discord" width={16} height={16} style={{ filter: 'brightness(0) invert(1)' }} />
            </Link>
            <Link
              href="https://x.com/mustangfinance"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                display: "flex",
                alignItems: "center",
                color: "rgba(255, 255, 255, 0.7)",
                _hover: { 
                  color: "white",
                },
                _focusVisible: {
                  outline: "2px solid rgba(255, 255, 255, 0.5)",
                },
                _active: {
                  translate: "0 1px",
                },
              })}
            >
              <Image src={XIcon} alt="X" width={16} height={16} style={{ filter: 'brightness(0) invert(1)' }} />
            </Link>
            <Link
              href="https://docs.must.finance/"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "rgba(255, 255, 255, 0.7)",
                _hover: { 
                  color: "white",
                  textDecoration: "underline",
                },
                _focusVisible: {
                  outline: "2px solid rgba(255, 255, 255, 0.5)",
                },
                _active: {
                  translate: "0 1px",
                },
              })}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor"
                className={css({ hideBelow: "medium" })}
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="15 3 21 3 21 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="10" y1="14" x2="21" y2="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={css({ hideBelow: "medium" })}>Docs</span>
            </Link>
          </div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: {
                base: 8,
                medium: 16,
              },
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "12px",
            })}
          >
            <div
              className={css({
                display: "flex",
                flexDirection: {
                  base: "column",
                  medium: "row",
                },
                alignItems: {
                  base: "flex-end",
                  medium: "center",
                },
                gap: {
                  base: 2,
                  medium: 8,
                },
                fontSize: {
                  base: "10px",
                  medium: "12px",
                },
              })}
            >
              <Link
                href="https://docs.must.finance/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className={css({
                  color: "rgba(255, 255, 255, 0.7)",
                  _hover: { 
                    color: "white",
                    textDecoration: "underline",
                  },
                  _focusVisible: {
                    outline: "2px solid rgba(255, 255, 255, 0.5)",
                  },
                  _active: {
                    translate: "0 1px",
                  },
                })}
              >
                Privacy Policy
              </Link>
              <span>© Saga Stablecoin 2025</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
