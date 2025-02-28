import React from 'react';
import Image from 'next/image';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { Button } from '@liquity2/uikit';

interface LiquidityPoolProps {
  pool: {
    id: number;
    pair: string;
    liquidity: string;
    token1: React.ReactNode;
    token2: React.ReactNode;
    dex: string;
  };
}

export function LiquidityPoolCard({ pool }: LiquidityPoolProps) {
  return (
    <div
      className={css({ 
        px: '10px', 
        py: '8px',
        borderRadius: 'lg',
        transition: 'transform 0.2s ease',
        _hover: { transform: 'scale(1.02)' },
        bg: 'surface',
        boxShadow: 'sm',
        border: '1px solid token(colors.border)'
      })}
    >
      <div className={flex({ 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: '4' 
      })}>
        <div className={flex({ alignItems: 'center' })}>
          <div className={css({ position: 'relative', height: '8', width: '16' })}>
            <div className={css({ position: 'absolute', left: '0', zIndex: '2' })}>
              {pool.token1}
            </div>
            <div className={css({ position: 'absolute', left: '12', zIndex: '1' })}>
              {pool.token2}
            </div>
          </div>
          <div className={css({ ml: '24', height: '8' })}>
            <p className={css({ fontSize: 'sm', color: 'textMuted' })}>{pool.pair}</p>
          </div>
        </div>
        <Image
          src={pool.dex}
          alt="DEX"
          width={24}
          height={24}
          className={css({ borderRadius: 'full' })}
        />
      </div>
      <div className={css({ mb: '4' })}>
        <p className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{pool.liquidity}</p>
        <p className={css({ fontSize: 'sm', color: 'textMuted' })}>Liquidity</p>
      </div>
      <Button 
        label="Trade"
        className={css({ width: 'full' })}
      />
    </div>
  );
} 