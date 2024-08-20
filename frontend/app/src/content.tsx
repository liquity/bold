import type { ReactNode as N } from "react";

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // Used in the top bar and other places
  appName: "Liquity v2",

  // Menu bar
  menu: {
    dashboard: "Dashboard",
    borrow: "Borrow",
    leverage: "Leverage",
    earn: "Earn",
    stake: "Stake",
  },

  accountButton: {
    wrongNetwork: "Wrong network",
    connectAccount: "Connect",
  },

  generalInfotooltips: {
    loanLiquidationRisk: [
      "Liquidation risk",
      "If your collateral becomes undercollateralized, it can be liquidated. Your debt is paid off but you lose most of your collateral. Increase your deposit or decrease your loan to lower the risk.",
    ],
    loanRedemptionRisk: [
      "Redemption risk",
      <>
        If BOLD trades below $1, your collateral may be{" "}
        <a
          href="https://docs.liquity.org/faq/lusd-redemptions"
          rel="noopener noreferrer"
          target="_blank"
        >
          redeemed
        </a>. Redemptions start from the lowest interest rate loans. Raise the interest rate on your loan to reduce the
        risk.
      </>,
    ],
    loanLtv: [
      "Loan-to-value ratio",
      "The ratio between your deposited collateral and the amount of BOLD you have chosen to borrow.",
    ],
    loanMaxLtv: [
      "Maximum loan-to-value ratio",
      "The maximum ratio between your collateral and the BOLD that you mint allowed at origination.",
    ],
    loanLiquidationPrice: [
      "Liquidation price",
      "The collateral price at which your position would be liquidated.",
    ],
    ethPrice: [
      "ETH price",
      "The current price of ETH in USD, as reported by the oracle. This is used to determine the loan-to-value ratio of your loan.",
    ],
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
        description: "Cover liquidations to earn BOLD and collateral assets.",
      },
      stake: {
        title: "Stake LQTY",
        description: "Accrue voting power by staking your LQTY without a minimum lockup period.",
      },
    },
    statsBar: {
      label: "Protocol stats",
    },
    infoTooltips: {
      avgInterestRate: [
        "The current average interest rate being paid by ETH-backed positions.",
      ],
      spApr: [
        "Annual Percentage Rate",
        "The annual percentage rate being earned by each stability pool’s deposits over the past 7 days.",
      ],
      spTvl: [
        "Total Value Locked",
        "The total amount of BOLD deposited in each stability pool.",
      ],
      borrowTvl: [
        "Total Value Locked",
        "The total amount of collateral deposited.",
      ],
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
    infoTooltips: {
      interestRateSuggestions: [
        "Positions with lower interest rates are the first to be redeemed by BOLD holders.",
      ],
      interestRateBoldPerYear: [
        "Your annualized interest burden at your selected position rate.",
      ],
    },
  },

  // Leverage screen
  leverageScreen: {
    headline: (tokensIcons: N) => (
      <>
        Leverage your exposure to {tokensIcons}
      </>
    ),
    depositField: {
      label: "You deposit",
    },
    liquidationPriceField: {
      label: "ETH Liquidation price",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Open leveraged loan",
    infoTooltips: {
      leverageLevel: [
        "Leverage level",
        "Choose the amplification of your exposure. Note that a higher level means higher liquidation risk. You are responsible for your own assessment of what a suitable level is.",
      ],
      interestRateSuggestions: [
        "Positions with lower interest rates are the first to be redeemed by BOLD holders.",
      ],
      interestRateBoldPerYear: [
        "Your annualized interest burden at your selected position rate.",
      ],
      exposure: [
        "Exposure",
        "Your total exposure to the collateral asset after amplification.",
      ],
    },
  },

  // Earn home screen
  earnHome: {
    headline: (tokensIcons: N, boldIcon: N) => (
      <>
        Earn {tokensIcons} with {boldIcon} BOLD
      </>
    ),
    subheading: "Get BOLD and extra ETH rewards from liquidations",
    poolsColumns: {
      pool: "Pool",
      apr: "APR",
      myDepositAndRewards: "My Deposits and Rewards",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total BOLD covering {collateral}-backed position liquidations</>,
      ],
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
    headerApr: () => (
      <>
        Current <abbr title="Annual percentage rate">APR</abbr>
      </>
    ),
    accountPosition: {
      depositLabel: "My deposit",
      shareLabel: "Pool share",
      rewardsLabel: "My rewards",
    },
    tabs: {
      deposit: "Deposit",
      withdraw: "Withdraw",
      claim: "Claim rewards",
    },
    depositPanel: {
      label: "You deposit",
      shareLabel: "New pool share",
      claimCheckbox: "Also claim rewards",
      action: "Add deposit",
      actionClaim: "Add deposit and claim rewards",
    },
    withdrawPanel: {
      label: "You withdraw",
      claimCheckbox: "Also claim rewards",
      action: "Withdraw",
      actionClaim: "Withdraw and claim rewards",
    },
    rewardsPanel: {
      label: "You claim",
      details: (usdAmount: N, fee: N) => (
        <>
          ~${usdAmount} • Expected gas fee ~${fee}
        </>
      ),
      action: "Claim rewards",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total BOLD covering {collateral}-backed position liquidations.</>,
      ],
      depositPoolShare: [
        "Ratio of your BOLD deposits versus the total stability pool.",
      ],
      alsoClaimRewardsCheckbox: [
        "Trigger a payout of your accrued BOLD and ETH rewards.",
      ],
      currentApr: [
        "Average annualized return for BOLD deposits over the past 7 days.",
      ],
      rewardsEth: [
        "ETH rewards",
        "Your proceeds from liquidations conducted by this stability pool.",
      ],
      rewardsBold: [
        "BOLD rewards",
        "Your earnings from protocol revenue distributions to this stability pool.",
      ],
    },
  },

  // Stake screen
  stakeScreen: {
    header: (lqtyIcon: N, lusdEthIcons: N) => (
      <>
        <span>Stake</span>
        {lqtyIcon} <span>LQTY & get</span>
        {lusdEthIcons} <span>LUSD + ETH</span>
      </>
    ),
    accountDetails: {
      myDeposit: "My deposit",
      votingPower: "Voting power",
      votingPowerHelp: (
        <>
          Voting power is the percentage of the total staked LQTY that you own.
        </>
      ),
      unclaimed: "Unclaimed rewards",
    },
    tabs: {
      deposit: "Deposit",
      withdraw: "Withdraw",
      claim: "Claim rewards",
    },
    depositPanel: {
      label: "You deposit",
      shareLabel: "New pool share",
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
          ~${usdAmount} • Expected gas fee ~${fee}
        </>
      ),
      action: "Claim rewards",
    },
  },
};
