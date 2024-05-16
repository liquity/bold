import type { ReactNode as N } from "react";

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
        description: "Set your own interest rate and borrow BOLD against ETH and staked ETH.",
      },
      leverage: {
        title: "Leverage ETH",
        description: "Set your own interest rate and increase your exposure to ETH and staked ETH.",
      },
      earn: {
        title: "Earn with BOLD",
        description: "Earn defi-native yield with your BOLD.",
      },
      stake: {
        title: "Stake LQTY",
        description: "Use LQTY to generate yield without a minimum lockup period.",
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
        Deposit {tokensIcons} to Borrow {boldIcon} BOLD
      </>
    ),
    subheading: "With your own interest rate or ready-to-use strategies",
    depositField: {
      label: "You deposit",
    },
    borrowField: {
      label: "You borrow",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Open new loan",
  },
};
