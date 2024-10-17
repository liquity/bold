import type { ReactNode as N } from "react";

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // Used in the top bar and other places
  appName: "Liquity V2",

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
      "If the LTV of a loan falls below the max LTV, it becomes undercollateralized and be liquidated. In that case, the borrower's debt is paid off but they lose most of their collateral. In order to avoid liquidation, one can increase the deposit or reduce the debt.",
    ],
    loanRedemptionRisk: [
      "Redemption risk",
      <>
        If the price of BOLD is lower than $1,{" "}
        <Link href="https://github.com/liquity/bold#bold-redemptions">redemptions are enabled</Link>{" "}
        and help bring the value of BOLD back to $1. Redemptions first affect loans with the lowest interest rate.
        Raising the interest rate reduces the redemption risk.
      </>,
    ],
    loanLtv: [
      "Loan-to-value ratio",
      "The ratio between the amount of BOLD borrowed and the deposited collateral (in USD).",
    ],
    loanMaxLtv: [
      "Maximum Loan-To-Value (LTV) Ratio",
      "The maximum ratio between the USD value of a loan (in BOLD) and the connected collateral. As long as a loan remains under the maximum LTV, a loan won't get liquidated. Keep in mind that the LTV will fluctuate as the prices of underlying assets changes.",
    ],
    loanLiquidationPrice: [
      "Liquidation price",
      "The collateral price at which a loan can be liquidated.",
    ],
    ethPrice: [
      "ETH Price",
      "The current price of ETH, as reported by the oracle. The ETH price is used to calculate the Loan-To-Value (LTV) ratio of a loan.",
    ],
    interestRateBoldPerYear: [
      "Interest rate",
      "The annualized interest amount in BOLD for the selected interest rate. The accumulated interest is added to the loan.",
    ],
    interestRateAdjustment: [
      "Interest rate adjustment",
      "The interest rate can be adjusted at any time. If it is adjusted within less than seven days of the last adjustment, there is a fee.",
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
      label: "ETH liquidation price",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Next: Summary",
    infoTooltips: {
      interestRateSuggestions: [
        "Positions with lower interest rates are the first to be redeemed by BOLD holders.",
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
      label: "ETH liquidation price",
    },
    interestRateField: {
      label: "Interest rate",
    },
    action: "Next: Summary",
    infoTooltips: {
      leverageLevel: [
        "Leverage level",
        "Choose the amplification of your exposure. Note that a higher level means higher liquidation risk. You are responsible for your own assessment of what a suitable level is.",
      ],
      interestRateSuggestions: [
        "Positions with lower interest rates are the first to be redeemed by BOLD holders.",
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
        Deposit {boldIcon} BOLD to earn rewards {tokensIcons}
      </>
    ),
    subheading: (
      <>
        A BOLD deposit in a stability pool earns rewards from the fees that users pay on their loans. Also, in case the
        system needs to liquidate positions, the BOLD may be swapped to collateral.
      </>
    ),
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
      boldRewardsLabel: "Your earnings from protocol revenue distributions to this stability pool",
      collRewardsLabel: "Your proceeds from liquidations conducted by this stability pool",
      totalUsdLabel: "Total in USD",
      expectedGasFeeLabel: "Expected gas fee",
      action: "Next: Summary",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total BOLD covering {collateral}-backed position liquidations.</>,
      ],
      depositPoolShare: [
        "Percentage of your BOLD deposit compared to the total deposited in this stability pool.",
      ],
      alsoClaimRewardsDeposit: [
        <>
          If checked, rewards are paid out as part of the update transaction.
        </>,
      ],
      alsoClaimRewardsWithdraw: [
        <>
          If checked, rewards are paid out as part of the update transaction.<br />
          Note: This needs to be checked to fully withdraw from the Stability Pool.
        </>,
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
    headline: (lqtyIcon: N, lusdEthIcons: N) => (
      <>
        <span>Stake</span>
        {lqtyIcon} <span>LQTY & get</span>
        {lusdEthIcons} <span>LUSD + ETH</span>
      </>
    ),
    subheading: (
      <>
        Staking LQTY tokens, you earn a share of borrowing and redemption fees in the Liquity V1 protocol.
      </>
    ),
    learnMore: ["https://docs.liquity.org/faq/staking", "Learn more"],
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
      deposit: "Staking",
      rewards: "Rewards",
      voting: "Voting",
    },
    depositPanel: {
      label: "Deposit",
      shareLabel: "Pool share",
      rewardsLabel: "Available rewards",
      action: "Next: Summary",
    },
    rewardsPanel: {
      label: "You claim",
      details: (usdAmount: N, fee: N) => (
        <>
          ~${usdAmount} • Expected gas fee ~${fee}
        </>
      ),
      action: "Next: Summary",
    },
    infoTooltips: {
      alsoClaimRewardsDeposit: [
        <>
          Rewards will be paid out as part of the update transaction.
        </>,
      ],
    },
  },
};

function Link({
  href,
  children,
}: {
  href: string;
  children: N;
}) {
  const props = !href.startsWith("http") ? {} : {
    target: "_blank",
    rel: "noopener noreferrer",
  };
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
