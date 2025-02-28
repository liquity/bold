"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { css } from "@/styled-system/css";
import { flex, grid } from "@/styled-system/patterns";
import { LiquidityPoolCard } from "./components/LiquidityPoolCard";
import { ProjectCard } from "@/src/screens/EcosystemScreen/components/ProjectCard";
import { a, useSpring } from "@react-spring/web";
import { TokenIcon } from "@liquity2/uikit";

const projects = [
  { name: 'Teller', logo: '/images/ecosystem/teller.png' },
  { name: 'Bunni', logo: '/images/ecosystem/bunni.png' },
  { name: 'Camelot', logo: '/images/ecosystem/camelot.png' },
  { name: 'Squid Router', logo: '/images/ecosystem/squid.png' },
  { name: 'API3', logo: '/images/ecosystem/api3.png' },
  { name: 'Liquity', logo: '/images/ecosystem/liquity.png' },
  { name: '0xpossum', logo: '/images/ecosystem/0xpossum.png' },
  { name: 'Summerstone', logo: '/images/ecosystem/summerstone.png' },
  { name: 'defi collective', logo: '/images/ecosystem/defi-collective.png' },
  { name: 'Arbitrum Foundation', logo: '/images/ecosystem/arbitrum.png' },
  { name: 'Starboard Side finance', logo: '/images/ecosystem/starboard.png' },
  { name: 'Superfluid', logo: '/images/ecosystem/superfluid.png' },
  { name: 'Defi Saver', logo: '/images/ecosystem/defi-saver.png' },
  { name: 'Aragon', logo: '/images/ecosystem/aragon.png' },
];

const liquidityPools = [
  {
    id: 1,
    pair: 'USDN / ETH',
    liquidity: '$308.28M',
    token1: <TokenIcon symbol="USDN" />,
    token2: <TokenIcon symbol="ETH" />,
    dex: '/images/dex/uniswap.png',
  },
  {
    id: 2,
    pair: 'USDN / USDC',
    liquidity: '$111.04M',
    token1: <TokenIcon symbol="USDN" />,
    token2: <TokenIcon symbol="USDN" />, // TO DO: Change to USDC
    dex: '/images/dex/sushiswap.png',
  },
  {
    id: 3,
    pair: 'USDN / BOLD',
    liquidity: '355,672',
    token1: <TokenIcon symbol="USDN" />,
    token2: <TokenIcon symbol="LQTY" />, // TO DO: Change to BOLD
    dex: '/images/dex/curve.png',
  },
];

export function EcosystemScreen() {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: 64,
        width: "100%",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          alignItems: "center",
          fontSize: 48,
          fontWeight: 600,
          color: "text",
        })}
      >
        <h1>Ecosystem</h1>
      </div>
      {/* Hero Section with Liquidity Pools */}
      <div className={grid({ 
        gridTemplateColumns: { base: '1fr', medium: 'repeat(3, 1fr)' }, 
        gap: '6',
        mb: '16'
      })}>
        {liquidityPools.map((pool) => (
          <LiquidityPoolCard key={pool.id} pool={pool} />
        ))}
      </div>

      {/* Projects Grid */}
      <div className={grid({ 
        gridTemplateColumns: { 
          base: '1fr',
          small: 'repeat(2, 1fr)',
          medium: 'repeat(3, 1fr)',
          large: 'repeat(4, 1fr)'
        }, 
        gap: '6'
      })}>
        {projects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
      </div>
    </div>
  );
} 