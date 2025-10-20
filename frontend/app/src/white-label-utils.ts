import type { Address } from "@/src/types";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";

type SupportedChainId = keyof typeof WHITE_LABEL_CONFIG.tokens.mainToken.deployments;

type MainTokenDeployment = {
  token: string;
  collateralRegistry: string;
  governance: string;
  hintHelpers: string;
  multiTroveGetter: string;
  exchangeHelpers: string;
};

type CollateralDeployment = {
  collToken: string;
  leverageZapper: string;
  stabilityPool: string;
  troveManager: string;
};

// Get deployment info for current chain
export function getDeploymentInfo(chainId: number) {
  if (!(chainId in WHITE_LABEL_CONFIG.tokens.mainToken.deployments)) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  
  const typedChainId = chainId as SupportedChainId;
  const mainTokenDeployment: MainTokenDeployment = WHITE_LABEL_CONFIG.tokens.mainToken.deployments[typedChainId];
  
  if (!mainTokenDeployment) {
    throw new Error(`No deployment info for chain ${chainId}`);
  }

  return {
    BOLD_TOKEN: mainTokenDeployment.token as Address,
    COLLATERAL_REGISTRY: mainTokenDeployment.collateralRegistry as Address,
    GOVERNANCE: mainTokenDeployment.governance as Address,
    HINT_HELPERS: mainTokenDeployment.hintHelpers as Address,
    MULTI_TROVE_GETTER: mainTokenDeployment.multiTroveGetter as Address,
    EXCHANGE_HELPERS: mainTokenDeployment.exchangeHelpers as Address,
    BRANCHES: WHITE_LABEL_CONFIG.tokens.collaterals.map((collateral, index) => {
      if (!(chainId in collateral.deployments)) {
        throw new Error(`No deployment for ${collateral.symbol} on chain ${chainId}`);
      }
      
      const deployment: CollateralDeployment = collateral.deployments[typedChainId];
      return {
        branchId: index,
        symbol: collateral.symbol,
        name: collateral.name,
        COLL_TOKEN: deployment.collToken as Address,
        LEVERAGE_ZAPPER: deployment.leverageZapper as Address,
        STABILITY_POOL: deployment.stabilityPool as Address,
        TROVE_MANAGER: deployment.troveManager as Address,
      };
    }),
  };
}

// Get collateral config by symbol
export function getCollateralConfig(symbol: string) {
  const collateral = WHITE_LABEL_CONFIG.tokens.collaterals.find(c => c.symbol === symbol);
  if (!collateral) {
    throw new Error(`Unknown collateral: ${symbol}`);
  }
  return collateral;
}

// Get collateral deployment for current chain
export function getCollateralDeployment(symbol: string, chainId: number) {
  const collateral = getCollateralConfig(symbol);
  
  if (!(chainId in collateral.deployments)) {
    throw new Error(`No deployment for ${symbol} on chain ${chainId}`);
  }
  
  const typedChainId = chainId as SupportedChainId;
  const deployment: CollateralDeployment = collateral.deployments[typedChainId];
  return deployment;
}

// Get all collateral limits
export function getCollateralLimits() {
  return Object.fromEntries(
    WHITE_LABEL_CONFIG.tokens.collaterals.map(c => [
      c.symbol,
      {
        maxDeposit: c.maxDeposit,
        maxLTV: c.maxLTV,
        collateralRatio: c.collateralRatio,
      },
    ])
  );
}