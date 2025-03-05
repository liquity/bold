"use client";

import { css } from "@/styled-system/css";
import { grid } from "@/styled-system/patterns";
import { LiquidityPoolCard } from "./components/LiquidityPoolCard";
import { ProjectCard } from "@/src/screens/EcosystemScreen/components/ProjectCard";
import { TokenIcon } from "@liquity2/uikit";
import { useState } from "react";

// Define categories for filtering
const categories = [
  "Infrastructure", 
  "SocialFi", 
  "DeFi", 
  "Wallets", 
  "DEXs", 
  "RWA", 
  "NFT"
];

const projects = [
  { 
    name: 'Teller', 
    logo: '/images/ecosystem/teller.png', 
    url: "https://www.teller.org/",
    categories: ["DeFi"],
    description: "DeFi lending protocol with credit risk assessment."
  },
  { 
    name: 'Bunni', 
    logo: '/images/ecosystem/bunni.png', 
    url: "https://bunni.pro/",
    categories: ["DeFi", "DEXs"],
    description: "Advanced liquidity management protocol for Uniswap v3."
  },
  { 
    name: 'Camelot', 
    logo: '/images/ecosystem/camelot.png', 
    url: "https://camelot.exchange/",
    categories: ["DEXs"],
    description: "Community-driven DEX built for Arbitrum."
  },
  { 
    name: 'Squid Router', 
    logo: '/images/ecosystem/squidrouter.jpg', // TO DO: Image missing
    url: "https://squidrouter.com/",
    categories: ["Infrastructure", "DeFi", "DEXs"],
    description: "Cross-chain liquidity routing protocol."
  },
  { 
    name: 'API3', 
    logo: '/images/ecosystem/api3.png', 
    url: "https://api3.org/",
    categories: ["Infrastructure"],
    description: "First-party oracle solution for Web3."
  },
  { 
    name: 'Liquity', 
    logo: '/images/ecosystem/liquity.png', 
    url: "https://liquity.org/",
    categories: ["DeFi"],
    description: "Interest-free borrowing protocol on Ethereum."
  },
  { 
    name: '0xpossum', 
    logo: '/images/ecosystem/0xpossum.png', // TO DO: Image missing
    url: "https://0xpossum.xyz/", // TO DO: Link missing
    categories: ["DeFi"],
    description: "Permissionless debt marketplace for DAOs and protocols."
  },
  { 
    name: 'Summerstone', 
    logo: '/images/ecosystem/summerstone.png', 
    url: "https://summerstone.xyz/",
    categories: ["RWA"],
    description: "Tokenized real estate investment platform."
  },
  { 
    name: 'Defi Collective', 
    logo: '/images/ecosystem/deficollective.jpg', 
    url: "https://deficollective.org/",
    categories: ["DeFi", "SocialFi"],
    description: "DAO-powered DeFi incubator and accelerator."
  },
  { 
    name: 'Arbitrum Foundation', 
    logo: '/images/ecosystem/arbitrum.png', 
    url: "https://arbitrum.foundation/",
    categories: ["Infrastructure"],
    description: "Supporting the growth of the Arbitrum ecosystem."
  },
  { 
    name: 'Starboard Side finance', 
    logo: '/images/ecosystem/starboard.png', // TO DO: Image missing
    url: "https://starboard.xyz/", // TO DO: Link missing
    categories: ["DeFi"],
    description: "Next-gen structured products for DeFi traders."
  },
  { 
    name: 'Superfluid', 
    logo: '/images/ecosystem/superfluid.png', 
    url: "https://superfluid.finance/",
    categories: ["Infrastructure"],
    description: "Real-time finance protocol with programmable cashflows."
  },
  { 
    name: 'Defi Saver', 
    logo: '/images/ecosystem/defisaver.jpg', 
    url: "https://defisaver.com/",
    categories: ["DeFi"],
    description: "All-in-one dashboard for managing DeFi positions."
  },
  { 
    name: 'Aragon', 
    logo: '/images/ecosystem/aragon.png', 
    url: "https://app.aragon.org/#/daos/arbitrum/0x108f48e558078c8ef2eb428e0774d7ecd01f6b1d/dashboard",
    categories: ["Infrastructure", "SocialFi"],
    description: "DAO governance and management platform."
  },
];

const liquidityPools = [
  {
    id: 1,
    asset1: {
      icon: <TokenIcon symbol="USDN" />,
      symbol: 'USDN',
      pricePer: '2100',
    },
    asset2: {
      icon: <TokenIcon symbol="ETH" />,
      symbol: 'ETH',
      pricePer: '0.00000067',
    },
    dex: '/images/dex/uniswap.png',
  },
  {
    id: 2,
    asset1: {
      icon: <TokenIcon symbol="USDN" />,
      symbol: 'USDN',
      pricePer: '0.99',
    },
    asset2: {
      icon: <TokenIcon symbol="USDN" />, // TODO: Change to USDC
      symbol: 'USDC',
      pricePer: '1',
    },
    dex: '/images/dex/sushiswap.png',
  },
  {
    id: 3,
    asset1: {
      icon: <TokenIcon symbol="USDN" />,
      symbol: 'USDN',
      pricePer: '1',
    },
    asset2: {
      icon: <TokenIcon symbol="LQTY" />, // TODO: Change to BOLD
      symbol: 'BOLD',
      pricePer: '1',
    },
    dex: '/images/dex/curve.png',
  },
];

export function EcosystemScreen() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Toggle filter selection
  const toggleFilter = (category: string) => {
    if (activeFilters.includes(category)) {
      setActiveFilters(activeFilters.filter(filter => filter !== category));
    } else {
      setActiveFilters([...activeFilters, category]);
    }
  };

  // Filter projects based on selected categories
  const filteredProjects = activeFilters.length === 0
    ? projects
    : projects.filter(project => 
        project.categories.some(category => activeFilters.includes(category))
      );

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

      <div className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
      })}>  
        {/* Filter Section */}
        <div className={css({
          display: "flex",
          alignItems: "center", 
          flexWrap: "wrap",
          gap: 3,
          mb: 8,
          padding: "4px 12px",
          borderRadius: "8px",
        })}>
          <span className={css({
            fontSize: "md", 
            fontWeight: "medium",
            mr: 4,
            color: "gray.800"
          })}>
            Filter by
          </span>
          
          {categories.map(category => (
            <button 
              key={category}
              className={css({
                px: '8px',
                py: "6px",
                borderRadius: "full",
                border: "1px solid",
                borderColor: activeFilters.includes(category) ? "transparent" : "rgba(47, 66, 37, 0.1)",
                backgroundColor: activeFilters.includes(category) ? "rgba(47, 66, 37, 1)" : "transparent",
                color: activeFilters.includes(category) ? "white" : "gray.800",
                fontSize: "sm",
                fontWeight: "medium",
                cursor: "pointer",
                transition: "all 0.2s ease",
                _hover: {
                  backgroundColor: "rgba(47, 66, 37, 0.3)",
                }
              })}
              onClick={() => toggleFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Projects Grid */}
        <div className={grid({ 
          gridTemplateColumns: { 
            base: '1fr',
            small: 'repeat(2, 1fr)',
            medium: 'repeat(3, 1fr)',
            large: 'repeat(3, 1fr)'
          }, 
          gap: '6'
        })}>
          {filteredProjects.map((project, index) => (
            <ProjectCard key={index} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
} 