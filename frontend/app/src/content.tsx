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
    multiply: "Multiply",
    earn: "Earn",
    stake: "Stake",
    buy: "Buy USND",
    stream: "Stream",
    ecosystem: "Ecosystem",
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
        undercollateralized and will be liquidated. In that case, the
        borrower&apos;s debt is paid off but they lose most of their collateral.
        In order to avoid liquidation, one can increase the collateral or reduce
        the debt.
      </>,
    ],
    loanRedemptionRisk: [
      "Redemption risk",
      <>
        Users paying the lowest interest rate can get redeemed, if the price of
        USND falls below $1. By raising your interest rate, you reduce this
        risk.
      </>,
    ],
    loanLtv: [
      "Loan-to-value ratio",
      <>
        The ratio between the amount of USND borrowed and the deposited
        collateral (in USD).
      </>,
    ],
    loanMaxLtv: [
      "Maximum Loan-To-Value (LTV) Ratio",
      <>
        The maximum ratio between the USD value of a loan (in USND) and the
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
        The annualized interest amount in USND for the selected interest rate.
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
          When USND trades for under $1, anyone can redeem positions to get USND
          back at $1. Positions with the lowest interest rate get redeemed
          first.
        </>
      ),
      footerLink: {
        href: "https://docs.nerite.org/docs/user-docs/redemption-and-delegation",
        label: "Learn more",
      },
    },
  },

  // Redemption info box
  redemptionInfo: {
    title: "Redemptions in a nutshell",
    subtitle: (
      <>
        Redemptions help maintain USND's peg in a decentralized way. If a user
        is redeemed, their collateral and debt are reduced equally, resulting in
        no net loss.
      </>
    ),
    infoItems: [
      {
        icon: "usnd",
        text: "Redemptions occur when USND drops below $1.",
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
      href: "https://docs.nerite.org/docs/user-docs/redemption-and-delegation",
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
    claimOnly: (
      <>
        You are reclaiming your collateral and closing the position. The deposit
        will be returned to your wallet.
      </>
    ),
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
    buttonRepayAndClose: "Repay & close",
    buttonReclaimAndClose: "Reclaim & close",
  },

  // Home screen
  home: {
    openPositionTitle: "Open your first position",
    myPositionsTitle: "My positions",
    actions: {
      borrow: {
        title: "Borrow",
        description:
          "Mint USND against your collateral at whatever interest rate you want",
      },
      multiply: {
        title: "Multiply",
        description:
          "Increase your exposure to ETH and its staking yield with a single click",
      },
      earn: {
        title: "Earn with USND",
        description:
          "Deposit USND to earn protocol revenues and liquidation proceeds",
      },
      buy: {
        title: "USND",
        description: "Buy USND",
      },
      stream: {
        title: "Stream USND with Superfluid",
        description: "Send USND continuously by the millisecond. Perfect for subscriptions, payroll, etc.",
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
        "The total amount of USND deposited in each stability pool.",
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
        Borrow {boldIcon} USND with {tokensIcons}
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
        "Positions with lower interest rates are the first to be redeemed by USND holders.",
      ],
    },
  },

  // Multiply screen
  leverageScreen: {
    headline: (tokensIcons: N) => <>Multiply your exposure to {tokensIcons}</>,
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
        "Multiply level",
        <>
          Choose the amplification of your exposure. Note that a higher level
          means higher liquidation risk. You are responsible for your own
          assessment of what a suitable level is.
        </>,
      ],
      interestRateSuggestions: [
        <>
          Positions with lower interest rates are the first to be redeemed by
          USND holders.
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
        Deposit {boldIcon} USND to earn rewards {tokensIcons}
      </>
    ),
    subheading: (
      <>
        A USND deposit in a stability pool earns rewards from the fees that
        users pay on their loans. Also, in case the system needs to liquidate
        positions, the USND may be swapped to collateral.
      </>
    ),
    poolsColumns: {
      pool: "Pool",
      apr: "APR",
      myDepositAndRewards: "My Deposits and Rewards",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total USND covering {collateral}-backed position liquidations</>,
      ],
    },
    strategySection: {
      headline: (strategyIcons: N) => (
        <>
          Strategies {strategyIcons}
        </>
      ),
      subheading: (
        <>
          Partnered Protocols with other USND strategies. 
          Earn additional yield or find other opportunities from these third party protocols.
        </>
      )
    }
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
      deposit: "Deposit & Withdraw",
      claim: "Claim Rewards",
    },
    depositPanel: {
      label: "Increase deposit",
      shareLabel: "Pool share",
      claimCheckbox: "Claim rewards",
      action: "Next: Summary",
    },
    withdrawPanel: {
      label: "Decrease deposit",
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
        <>Total USND covering {collateral}-backed position liquidations.</>,
      ],
      depositPoolShare: [
        "Percentage of your USND deposit compared to the total deposited in this stability pool.",
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
        "Average annualized return for USND deposits over the past 7 days.",
      ],
      rewardsEth: [
        "ETH rewards",
        "Your proceeds from liquidations conducted by this stability pool.",
      ],
      rewardsBold: [
        "USND rewards",
        "Your earnings from protocol revenue distributions to this stability pool.",
      ],
    },
  },

  // Stake screen
  buyScreen: {
    headline: () => (
      <>
        <span>Buy USND </span>
      </>
    ),
    subheading: <>Buy USND</>,
    learnMore: ["https://docs.nerite.org/docs/user-docs/NERI-staking-and-voting", "Learn more"],
  },

  ecosystemScreen: {
    headline: (ecosystemIcon: N) => (
      <>
        Ecosystem {ecosystemIcon}
      </>
    ),
    subheading: (
      <>
        Partnered Protocols with other USND strategies. 
        Earn additional yield or find other opportunities from these third party protocols.
      </>
    ),
  },

  stakeScreen: {
    headline: (lqtyIcon: N) => (
      <>
        <span>Stake</span>
        {lqtyIcon} <span>NERI & get</span>
        <span>voting power</span>
      </>
    ),
    subheading: (
      <>
        By staking NERI you can vote on incentives for Nerite.
      </>
    ),
    learnMore: ["https://docs.nerite.org/docs/user-docs/NERI-staking-and-voting", "Learn more"],
    accountDetails: {
      myDeposit: "My deposit",
      votingPower: "Voting power",
      votingPowerHelp: (
        <>
          Voting power is the percentage of the total staked NERI that you own.
        </>
      ),
      unclaimed: "Unclaimed rewards",
    },
    tabs: {
      deposit: "Staking",
      // rewards: "Rewards",
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
    votingPanel: {
      title: "Allocate your voting power",
      intro: (
        <>
          Direct incentives from Nerite protocol revenues towards liquidity providers for USND. Upvote from Thursday
          to Tuesday. Downvote all week. <Link href="https://docs.nerite.org/docs/user-docs/NERI-staking-and-voting">Learn more</Link>
        </>
      ),
    },
    infoTooltips: {
      alsoClaimRewardsDeposit: [
        <>
          Rewards will be paid out as part of the update transaction.
        </>,
      ],
    },
  },
} as const;

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
