import type { ReactNode as N } from "react";

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // Used in the top bar and other places
  appName: "Liquity v2",

  // Menu bar
  menu: {
    borrow: "Borrow",
    leverage: "Leverage",
    earn: "Earn",
    stake: "Stake",
  },

  accountButton: {
    wrongNetwork: "Wrong network",
    connectAccount: "Connect wallet",
  },

  // Home screen
  home: {
    openPositionTitle: "Open your first position",
    myPositionsTitle: "My positions",
    actions: {
      borrow: {
        title: "Borrow BOLD",
        description: "Set your own interest rate or borrow BOLD against ETH and staked ETH.",
      },
      leverage: {
        title: "Leverage ETH",
        description: "Set your own interest rate or increase your exposure to ETH and staked ETH.",
      },
      earn: {
        title: "Earn with BOLD",
        description: "Cover liquidations to earn BOLD and collateral assets",
      },
      stake: {
        title: "Stake LQTY",
        description: "Accrue voting power by staking your LQTY without a minimum lockup period",
      },
    },
    products: {
      borrow: {
        title: "Borrow BOLD",
        description: "Set your own interest rate and borrow BOLD against ETH and staked ETH.",
        total: "Total borrowed",
        hint: "Borrow BOLD",
        avgIr: "Avg IR",
        maxLtv: "Max LTV",
      },
      leverage: {
        title: "Leverage ETH",
        description: "Increase your exposure to ETH and staked ETH",
        hint: "Leverage",
        avgIr: "Avg IR",
        avgLeverage: "Avg leverage",
      },
      earn: {
        title: "Earn with pools",
        description: "Earn defi-native yield from your BOLD",
        total: "In earn pools",
        hint: "Earn",
        apy: "APY",
        tvl: "TVL",
      },
    },
    statsBar: {
      label: "Protocol stats",
    },
  },

  // Earn home screen: header
  earnHome: {
    headline: (tokensIcons: N, boldIcon: N) => (
      <>
        Earn {tokensIcons} with {boldIcon} BOLD
      </>
    ),
    subheading: "Get BOLD and extra ETH rewards from liquidations",
    poolsColumns: {
      pool: "Pool",
      apy: "APY",
      myDepositAndRewards: "My Deposits and Rewards",
    },
  },

  // Earn screen
  earnScreen: {
    backButton: "See all pools",
    headerPool: (pool: N) => <>{pool} pool</>,
    headerTvl: (tvl: N) => (
      <>
        <abbr title="Total Value Locked">TVL</abbr> {tvl}
      </>
    ),
    headerApy: () => (
      <>
        Current <abbr title="Annual percentage yield">APY</abbr>
      </>
    ),
    accountPosition: {
      depositLabel: "My deposit",
      rewardsLabel: "My rewards",
    },
    tabs: {
      deposit: "Deposit",
      withdraw: "Withdraw",
      claim: "Claim rewards",
    },
    depositPanel: {
      label: "You deposit",
      shareLabel: (share: N) => (
        <>
          Share in the pool {share}
        </>
      ),
      claimCheckbox: "Also claim rewards",
      action: "Add deposit",
    },
    withdrawPanel: {
      label: "You withdraw",
      claimCheckbox: "Also claim rewards",
      action: "Withdraw",
    },
    rewardsPanel: {
      label: "You claim",
      details: (usdAmount: N, fee: N) => (
        <>
          ~{usdAmount} USD • Expected gas fee ~{fee} USD
        </>
      ),
      action: "Claim rewards",
    },
  },

  // Borrow screen
  borrowScreen: {
    headline: (tokensIcons: N, boldIcon: N) => (
      <>
        Borrow {boldIcon} BOLD with {tokensIcons} ETH
      </>
    ),
    depositField: {
      label: "You deposit",
    },
    borrowField: {
      label: "You borrow",
    },
    liquidationPriceField: {
      label: "ETH Liquidation price",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Open loan",
  },
};
