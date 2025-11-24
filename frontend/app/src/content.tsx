/* oxlint-disable react/jsx-key */

import type { ReactNode as N } from "react";

import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import { css } from "@/styled-system/css";

export default {
  // Used in the top bar and other places
  appName: WHITE_LABEL_CONFIG.branding.appName,
  appDescription: `
    ${WHITE_LABEL_CONFIG.branding.appDescription}
    and mint the stablecoin ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}.
  `,
  appUrl: typeof window === "undefined"
    ? WHITE_LABEL_CONFIG.branding.appUrl
    : window.location.origin,
  appIcon: (
    typeof window === "undefined" ? "" : window.location.origin
  ) + "/favicon.svg",

  // Menu bar
  menu: WHITE_LABEL_CONFIG.branding.menu,

  accountButton: {
    wrongNetwork: WHITE_LABEL_CONFIG.branding.ui.wrongNetwork,
    connectAccount: WHITE_LABEL_CONFIG.branding.ui.connectWallet,
  },

  generalInfotooltips: {
    loanLiquidationRisk: [
      "Liquidation risk",
      <>
        If the LTV of a loan goes above the max LTV, it becomes undercollateralized and will be liquidated. In that
        case, the borrower's debt is paid off but they lose most of their collateral. In order to avoid liquidation, one
        can increase the collateral or reduce the debt.
      </>,
    ],
    loanRedemptionRisk: [
      "Redemption risk",
      <>
        Users paying the lowest interest rate can get redeemed, if the price of ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} falls below $1. By raising your
        interest rate, you reduce this risk.
      </>,
    ],
    loanLtv: [
      "Loan-to-value ratio",
      <>
        The ratio between the amount of ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} borrowed and the deposited collateral (in USD).
      </>,
    ],
    loanMaxLtv: [
      "Maximum Loan-To-Value (LTV) Ratio",
      <>
        The maximum ratio between the USD value of a loan (in ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}) and the collateral backing it. The LTV will
        fluctuate as the price of the collateral changes. To decrease the LTV add more colateral or reduce debt.
      </>,
    ],
    loanLiquidationPrice: [
      "Liquidation price",
      <>The collateral price at which a loan can be liquidated.</>,
    ],
    collPrice: (collName: string) => [
      `${collName} Price`,
      <>
        The current price of {collName}, as reported by the oracle. The {collName} price is used to calculate the Loan-To-Value (LTV)
        ratio of a loan.
      </>,
    ],
    interestRateBoldPerYear: [
      "Interest rate",
      <>
        The annualized interest amount in ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} for the selected interest rate. The accumulated interest is added to the
        loan.
      </>,
    ],
    interestRateAdjustment: [
      "Interest rate adjustment",
      <>
        The interest rate can be adjusted at any time. If it is adjusted within less than seven days of the last
        adjustment, there is a fee.
      </>,
    ],
    redeemedLoan: {
      heading: "Your collateral and debt are reduced by the same value.",
      body: (
        <>
          When ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} trades for under $1, anyone can redeem positions to get ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} back at $1. Positions with the lowest
          interest rate get redeemed first.
        </>
      ),
      footerLink: {
        href: WHITE_LABEL_CONFIG.branding.links.docs.redemptions,
        label: "Learn more",
      },
    },
  },

  // Redemption info box
  redemptionInfo: {
    title: "Redemptions in a nutshell",
    subtitle: (
      <>
        Redemptions help maintain ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}’s peg in a decentralized way. If a user is redeemed, their collateral and debt
        are reduced equally, resulting in no net loss.
      </>
    ),
    infoItems: [
      {
        icon: "bold",
        text: `Redemptions occur when ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} drops below $1.`,
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
      href: WHITE_LABEL_CONFIG.branding.links.docs.redemptions,
    },
  },

  interestRateField: {
    delegateModes: {
      manual: {
        label: "Manual",
        secondary: <>The interest rate is set manually and can be updated at any time.</>,
      },
      delegate: {
        label: "Delegated",
        secondary: <>The interest rate is set and updated by a third party of your choice. They may charge a fee.</>,
      },
      strategy: {
        label: "Autonomous Rate Manager",
        secondary: (
          <>
            The interest rate is set and updated by an automated strategy running on the Internet Computer (ICP).
          </>
        ),
      },
    },

    icStrategyModal: {
      title: (
        <>
          Autonomous Rate Manager (ARM)
        </>
      ),
      intro: (
        <>
          These strategies are run on the Internet Computer (ICP). They are automated and decentralized. More strategies
          may be added over time.
        </>
      ),
    },

    delegatesModal: {
      title: "Set a delegate",
      intro: (
        <>
          The interest rate is set and updated by a third party of your choice. They may charge a fee.
        </>
      ),
    },
  },

  closeLoan: {
    claimOnly: (
      <>
        You are reclaiming your collateral and closing the position. The deposit will be returned to your wallet.
      </>
    ),
    repayWithBoldMessage: (
      <>
        You are repaying your debt and closing the position. The deposit will be returned to your wallet.
      </>
    ),
    repayWithCollateralMessage: (
      <>
        To close your position, a part of your collateral will be sold to pay back the debt. The rest of your collateral
        will be returned to your wallet.
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
        description: `Mint ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} against your collateral at whatever interest rate you want`,
      },
      multiply: {
        title: "Multiply",
        description: "Increase your exposure to ETH and its staking yield with a single click",
      },
      earn: {
        title: `Earn with ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}`,
        description: `Deposit ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} to earn protocol revenues and liquidation proceeds`,
      },
    },
    earnTable: {
      title: `Earn rewards with ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol}`,
      subtitle: `Earn ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} & ETH rewards by depositing your ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} in a stability pool`,
      forksInfo: {
        text: (
          <>
            <abbr title="Stability Pool">SP</abbr> depositors earn additional rewards from forks.
          </>
        ),
        titleAttr: "Stability Pool depositors earn additional rewards from forks.",
        learnMore: {
          url: WHITE_LABEL_CONFIG.branding.links.friendlyForkProgram,
          label: "Learn more",
          title: WHITE_LABEL_CONFIG.branding.features.friendlyFork.title,
        },
      },
    },
    yieldTable: {
      title: "Top 3 external yield opportunities",
      hint: {
        title: "All yield sources on Dune",
        url: "https://dune.com/liquity/liquity-v2-yields",
        label: "Learn more",
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
        `The total amount of ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} deposited in each stability pool.`,
      ],
      borrowTvl: [
        "Total Value Locked",
        "The total amount of collateral deposited.",
      ],
    },
  },

  // Borrow screen
  borrowScreen: {
    headline: (eth: N, bold: N) => (
      <>
        Borrow <NoWrap>{bold}</NoWrap>
        <br />
        with <NoWrap>{eth}</NoWrap>
      </>
    ),
    depositField: {
      label: "Collateral",
    },
    borrowField: {
      label: "Loan",
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
        `Positions with lower interest rates are the first to be redeemed by ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} holders.`,
      ],
    },
  },

  // Multiply screen
  leverageScreen: {
    headline: (tokensIcons: N) => (
      <>
        Multiply your exposure to {tokensIcons}
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
        "Multiply level",
        <>
          Choose the amplification of your exposure. Note that a higher level means higher liquidation risk. You are
          responsible for your own assessment of what a suitable level is.
        </>,
      ],
      interestRateSuggestions: [
        <>
          Positions with lower interest rates are the first to be redeemed by ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} holders.
        </>,
      ],
      exposure: [
        "Exposure",
        <>
          Your total exposure to the collateral asset after amplification.
        </>,
      ],
    },
  },

  // Earn home screen
  earnHome: {
    headline: (rewards: N, bold: N) => (
      <>
        Deposit
        <NoWrap>{bold} {WHITE_LABEL_CONFIG.tokens.mainToken.symbol}</NoWrap>
        to earn <NoWrap>rewards {rewards}</NoWrap>
      </>
    ),
    subheading: (
      <>
        A ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} deposit in a stability pool earns rewards from the fees that users pay on their loans. Also, the ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} may
        be swapped to collateral in case the system needs to liquidate positions.
      </>
    ),
    learnMore: [WHITE_LABEL_CONFIG.branding.links.docs.earn, "Learn more"],
    poolsColumns: {
      pool: "Pool",
      apr: "APR",
      myDepositAndRewards: "My Deposits and Rewards",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total {WHITE_LABEL_CONFIG.tokens.mainToken.symbol} covering {collateral}-backed position liquidations</>,
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
      boldRewardsLabel: "Your earnings from protocol revenue distributions to this stability pool",
      collRewardsLabel: "Your proceeds from liquidations conducted by this stability pool",
      totalUsdLabel: "Total in USD",
      expectedGasFeeLabel: "Expected gas fee",
      action: "Next: Summary",
    },
    infoTooltips: {
      tvl: (collateral: N) => [
        <>Total {WHITE_LABEL_CONFIG.tokens.mainToken.symbol} covering {collateral}-backed position liquidations.</>,
      ],
      depositPoolShare: [
        `Percentage of your ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} deposit compared to the total deposited in this stability pool.`,
      ],
      alsoClaimRewardsDeposit: [
        <>
          If checked, rewards are paid out as part of the update transaction. Otherwise rewards will be compounded into
          your deposit.
        </>,
      ],
      alsoClaimRewardsWithdraw: [
        <>
          If checked, rewards are paid out as part of the update transaction.<br />
          Note: This needs to be checked to fully withdraw from the Stability Pool.
        </>,
      ],
      currentApr: [
        `Average annualized return for ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} deposits over the past 7 days.`,
      ],
      rewardsEth: [
        "ETH rewards",
        "Your proceeds from liquidations conducted by this stability pool.",
      ],
      rewardsBold: [
        `${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} rewards`,
        "Your earnings from protocol revenue distributions to this stability pool.",
      ],
    },
  },
} as const;

function NoWrap({
  children,
  gap = 8,
}: {
  children: N;
  gap?: number;
}) {
  return (
    <span
      className={css({
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      })}
      style={{
        gap,
      }}
    >
      {children}
    </span>
  );
}
