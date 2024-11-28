/* eslint-disable react/jsx-key */
/* eslint-disable import/no-anonymous-default-export */

import type { ReactNode as N } from "react";

export default {
  // Used in the top bar and other places
  appName: "Nerite",

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
      <>
        If the LTV of a loan goes above the max LTV, it becomes
        undercollateralized and will be liquidated. In that case, the borrower's
        debt is paid off but they lose most of their collateral. In order to
        avoid liquidation, one can increase the collateral or reduce the debt.
      </>,
    ],
    loanRedemptionRisk: [
      "Redemption risk",
      <>
        Users paying the lowest interest rate can get redeemed, if the price of
        USDN falls below $1. By raising your interest rate, you reduce this
        risk.
      </>,
    ],
    loanLtv: [
      "Loan-to-value ratio",
      <>
        The ratio between the amount of USDN borrowed and the deposited
        collateral (in USD).
      </>,
    ],
    loanMaxLtv: [
      "Maximum Loan-To-Value (LTV) Ratio",
      <>
        The maximum ratio between the USD value of a loan (in USDN) and the
        collateral backing it. The LTV will fluctuate as the price of the
        collateral changes. To decrease the LTV add more colateral or reduce
        debt.
      </>,
    ],
    loanLiquidationPrice: [
      "Liquidation price",
      <>The collateral price at which a loan can be liquidated.</>,
    ],
    ethPrice: [
      "ETH Price",
      <>
        The current price of ETH, as reported by the oracle. The ETH price is
        used to calculate the Loan-To-Value (LTV) ratio of a loan.
      </>,
    ],
    interestRateBoldPerYear: [
      "Interest rate",
      <>
        The annualized interest amount in USDN for the selected interest rate.
        The accumulated interest is added to the loan.
      </>,
    ],
    interestRateAdjustment: [
      "Interest rate adjustment",
      <>
        The interest rate can be adjusted at any time. If it is adjusted within
        less than seven days of the last adjustment, there is a fee.
      </>,
    ],
    redeemedLoan: {
      heading: "Your collateral and debt are reduced by the same value.",
      body: (
        <>
          When USDN trades for under $1, anyone can redeem positions to get USDN
          back at $1. Positions with the lowest interest rate get redeemed
          first.
        </>
      ),
      footerLink: {
        href: "https://github.com/liquity/bold#bold-redemptions",
        label: "Learn more",
      },
    },
  },

  // Redemption info box
  redemptionInfo: {
    title: "Redemptions in a nutshell",
    subtitle: (
      <>
        Redemptions help maintain BOLD’s peg in a decentralized way. If a user
        is redeemed, their collateral and debt are reduced equally, resulting in
        no net loss.
      </>
    ),
    infoItems: [
      {
        icon: "bold",
        text: "Redemptions occur when USDN drops below $1.",
      },
      {
        icon: "redemption",
        text: "Redemptions first affect loans with the lowest interest rate.",
      },
      {
        icon: "interest",
        text: "Raising the interest rate reduces your redemption risk.",
      },
    ],
    learnMore: {
      text: "Learn more about redemptions",
      href: "https://github.com/liquity/bold#bold-redemptions",
    },
  },

  interestRateField: {
    delegateModes: {
      manual: {
        label: "Manual",
        secondary: (
          <>The interest rate is set manually and can be updated at any time.</>
        ),
      },
      delegate: {
        label: "Delegated",
        secondary: (
          <>
            The interest rate is set and updated by a third party of your
            choice. They may charge a fee.
          </>
        ),
      },
      strategy: {
        label: "Automated (ICP)",
        secondary: (
          <>
            The interest rate is set and updated by an automated strategy
            running on the decentralized Internet Computer (ICP).
          </>
        ),
      },
    },

    icStrategyModal: {
      title: (
        <>
          Automated Strategies (<abbr title='Internet Computer'>ICP</abbr>)
        </>
      ),
      intro: (
        <>
          These strategies are run on the Internet Computer (ICP). They are
          automated and decentralized. More strategies will be added over time.
        </>
      ),
    },

    delegatesModal: {
      title: "Set a delegate",
      intro: (
        <>
          The interest rate is set and updated by a third party of your choice.
          They may charge a fee.
        </>
      ),
    },
  },

  closeLoan: {
    repayWithBoldMessage: (
      <>
        You are repaying your debt and closing the position. The deposit will be
        returned to your wallet.
      </>
    ),
    repayWithCollateralMessage: (
      <>
        To close your position, a part of your collateral will be sold to pay
        back the debt. The rest of your collateral will be returned to your
        wallet.
      </>
    ),
  },

  // Home screen
  home: {
    openPositionTitle: "Open your first position",
    myPositionsTitle: "My positions",
    actions: {
      borrow: {
        title: "Borrow USDN",
        description:
          "Set your own interest rate and borrow USDN against ETH and staked ETH.",
      },
      leverage: {
        title: "Leverage ETH",
        description:
          "Set your own interest rate and increase your exposure to ETH and staked ETH.",
      },
      earn: {
        title: "Earn with USDN",
        description: "Cover liquidations to earn USDN and collateral assets.",
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
        "The total amount of USDN deposited in each stability pool.",
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
        Borrow {boldIcon} USDN with {tokensIcons} ETH
      </>
    ),
    depositField: {
      label: "You deposit",
    },
    borrowField: {
      label: "You borrow",
    },
    liquidationPriceField: {
      label: "ETH liquidation price",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Next: Summary",
    infoTooltips: {
      interestRateSuggestions: [
        "Positions with lower interest rates are the first to be redeemed by USDN holders.",
      ],
    },
  },

  // Leverage screen
  leverageScreen: {
    headline: (tokensIcons: N) => <>Leverage your exposure to {tokensIcons}</>,
    depositField: {
      label: "You deposit",
    },
    liquidationPriceField: {
      label: "ETH liquidation price",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Next: Summary",
    infoTooltips: {
      leverageLevel: [
        "Leverage level",
        <>
          Choose the amplification of your exposure. Note that a higher level
          means higher liquidation risk. You are responsible for your own
          assessment of what a suitable level is.
        </>,
      ],
      interestRateSuggestions: [
        <>
          Positions with lower interest rates are the first to be redeemed by
          USDN holders.
        </>,
      ],
      exposure: [
        "Exposure",
        <>Your total exposure to the collateral asset after amplification.</>,
      ],
    },
  },

  // Earn home screen
  earnHome: {
    headline: (tokensIcons: N, boldIcon: N) => (
      <>
        Deposit {boldIcon} USDN to earn rewards {tokensIcons}
      </>
    ),
    subheading: (
      <>
        A USDN deposit in a stability pool earns rewards from the fees that
        users pay on their loans. Also, in case the system needs to liquidate
        positions, the USDN may be swapped to collateral.
      </>
    ),
    poolsColumns: {
      pool: "Pool",
      apr: "APR",
      myDepositAndRewards: "My Deposits and Rewards",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total USDN covering {collateral}-backed position liquidations</>,
      ],
    },
  },

  // Earn screen
  earnScreen: {
    backButton: "See all pools",
    headerPool: (pool: N) => <>{pool} pool</>,
    headerTvl: (tvl: N) => (
      <>
        <abbr title='Total Value Locked'>TVL</abbr> {tvl}
      </>
    ),
    headerApr: () => (
      <>
        Current <abbr title='Annual percentage rate'>APR</abbr>
      </>
    ),
    accountPosition: {
      depositLabel: "My deposit",
      shareLabel: "Pool share",
      rewardsLabel: "My rewards",
    },
    tabs: {
      deposit: "Deposit",
      claim: "Claim rewards",
    },
    depositPanel: {
      label: "Deposit",
      shareLabel: "Pool share",
      claimCheckbox: "Claim rewards",
      action: "Next: Summary",
    },
    withdrawPanel: {
      label: "Withdraw",
      claimCheckbox: "Claim rewards",
      action: "Next: Summary",
    },
    rewardsPanel: {
      boldRewardsLabel:
        "Your earnings from protocol revenue distributions to this stability pool",
      collRewardsLabel:
        "Your proceeds from liquidations conducted by this stability pool",
      totalUsdLabel: "Total in USD",
      expectedGasFeeLabel: "Expected gas fee",
      action: "Next: Summary",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total USDN covering {collateral}-backed position liquidations.</>,
      ],
      depositPoolShare: [
        "Percentage of your USDN deposit compared to the total deposited in this stability pool.",
      ],
      alsoClaimRewardsDeposit: [
        <>
          If checked, rewards are paid out as part of the update transaction.
        </>,
      ],
      alsoClaimRewardsWithdraw: [
        <>
          If checked, rewards are paid out as part of the update transaction.
          <br />
          Note: This needs to be checked to fully withdraw from the Stability
          Pool.
        </>,
      ],
      currentApr: [
        "Average annualized return for USDN deposits over the past 7 days.",
      ],
      rewardsEth: [
        "ETH rewards",
        "Your proceeds from liquidations conducted by this stability pool.",
      ],
      rewardsBold: [
        "USDN rewards",
        "Your earnings from protocol revenue distributions to this stability pool.",
      ],
    },
  },
} as const;
