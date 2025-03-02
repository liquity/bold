import React from 'react';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import {
  AnchorTextButton,
  // TokenIcon,
  // TokenSymbol,
} from '@liquity2/uikit';

interface LiquidityPoolProps {
  pool: {
    id: number;
    asset1: {
      icon: React.ReactNode;
      symbol: string;
      pricePer: string;
    };
    asset2: {
      icon: React.ReactNode;
      symbol: string;
      pricePer: string;
    };
    dex: string;
  };
}

export function LiquidityPoolCard({ pool }: LiquidityPoolProps) {
  return (
    <div
      className={css({
        padding: "12px 16px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        userSelect: "none",
        color: `var(--fg-primary-inactive)`,
        background: `var(--bg-inactive)`,
        borderColor: "var(--border-inactive)",

        "--fg-primary-active": "token(colors.positionContent)",
        "--fg-primary-inactive": "token(colors.content)",

        "--fg-secondary-active": "token(colors.positionContentAlt)",
        "--fg-secondary-inactive": "token(colors.contentAlt)",

        "--border-active":
          "color-mix(in srgb, token(colors.secondary) 15%, transparent)",
        "--border-inactive": "token(colors.infoSurfaceBorder)",

        "--bg-active": "token(colors.position)",
        "--bg-inactive": "token(colors.infoSurface)",
      })}
    >
      <div className={flex({ 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: '4px' 
      })}>
        <div className={flex({ alignItems: 'center', height: '30px', mb: '12px' })}>
          <div className={css({ position: 'relative', minHeight: '10px', width: '20px' })}>
            <div className={css({ position: 'absolute', left: '0', zIndex: '2' })}>
              {pool.asset1.icon}
            </div>
            <div className={css({ position: 'absolute', left: '12', zIndex: '1' })}>
              {pool.asset2.icon}
            </div>
          </div>
          <div className={css({ ml: '24px', height: '10px' })}>
            <p className={css({ fontSize: '14px', color: 'textMuted' })}>{pool.asset1.symbol} / {pool.asset2.symbol}</p>
          </div>
        </div>
        {/* <Image
          src={"/images/ecosystem/camelot.png"}
          alt="Camelot"
          width={40}
          height={40}
          className={css({ borderRadius: 'full' })}
        /> */}
      </div>
      <div className={css({ mb: '8px' })}>
        <p className={css({ fontSize: '24px' })}>1 {pool.asset1.symbol} = {pool.asset2.pricePer} {pool.asset2.symbol}</p>
        <p className={css({ fontSize: '12px', color: 'var(--fg-secondary-inactive)' })}>1 {pool.asset2.symbol} = {pool.asset1.pricePer} {pool.asset1.symbol}</p>
      </div>
      <div className={flex({ justifyContent: 'flex-end' })}>
        <AnchorTextButton
          label={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 14,
              })}
            >
              Trade
              {/* <TokenIcon symbol={pool.asset1.symbol as TokenSymbol} size='mini' />
              <TokenIcon symbol={pool.asset2.symbol as TokenSymbol} size='mini' /> */}
            </div>
          }
          title={`Trade ${pool.asset1.symbol} for ${pool.asset2.symbol}`}
        />
      </div>
    </div>
  );
} 