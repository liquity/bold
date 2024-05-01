import type { ReactNode as N } from "react";

export default {
  // Top bar and other places
  appName: "Liquity v2",

  // Menu bar
  menu: {
    borrow: "Borrow",
    leverage: "Leverage",
    earn: "Earn",
    stake: "Stake",
  },

  // Earn home screen header
  earnHomeHeadline: (tokensIcons: N, boldIcon: N) => (
    <>
      Earn {tokensIcons} with {boldIcon} BOLD
    </>
  ),
  earnHomeSubheading: "Get BOLD and extra ETH rewards from liquidations",
};
