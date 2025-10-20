import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import type { WhiteLabelConfig } from "@/src/white-label.config";

/**
 * Hook to access white-label header configuration
 */
export function useWhiteLabelHeader() {
  return {
    appName: WHITE_LABEL_CONFIG.branding.brandName,
    navigation: {
      ...WHITE_LABEL_CONFIG.branding.navigation,
      items: WHITE_LABEL_CONFIG.branding.menu,
    },
  };
}

/**
 * Hook to access main token (stablecoin) configuration
 */
export function useMainToken() {
  return WHITE_LABEL_CONFIG.tokens.mainToken;
}

// Type exports
export type { WhiteLabelConfig };
export { WHITE_LABEL_CONFIG };