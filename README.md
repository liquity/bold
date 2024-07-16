# Liquity v2

## Significant changes in Liquity v2

- Multi-collateral system. The system now consists of a CollateralRegistry and multiple collateral branches. Each collateral branch contains its own TroveManager and StabilityPool. Troves in a given branch only accept the single collateral (never mixed collateral). Liquidations of Troves in a given branch via SP offset are offset purely against the SP for that branch, and liquidation gains for SP depositors are always paid in a single collateral. Similarly, liquidations via redistribution split the collateral and debt across purely active Troves in that branch.
 
- Collateral choices. The system will contain collateral branches for WETH and several LSTs: rETH, wstETH and one (or both) of osETH and ETHx. It does not accept native ETH as collateral.

- User-set interest rates. When a borrower opens a Trove, they choose their own annual interest rate. They may change their annual interest rate at any point. Simple (non-compounding) interest accrues on their debt continuously. Aggregate accrued Trove debt is periodically minted as BOLD. 

- Yield from interest paid to SP and LPs. BOLD yields from Trove interest are periodically paid out in a split to the Stability Pool (SP), and to a router which in turn routes its yield share to DEX LP incentives.  Yield paid to the SP from Trove interest on a given branch is always paid to the SP on that same branch.

- Redemption routing. Redemptions of BOLD are routed by the CollateralRegistry. For a given redemption, the redemption volume that hits a given branch is proportional to its relative “unbackedness”. The primary goal of redemptions is to restore the BOLD peg. A secondary purpose is to reduce the unbackedness of the most unbacked branches relatively more than the more backed branches. Unbackedness is defined as the delta between the total BOLD debt of the branch, and the BOLD in the branch’s SP.

- Redemption ordering. In a given branch, redemptions hit Troves in order of their annual interest rate, from lowest to highest. Troves with higher annual interest rates are more shielded from redemptions - they have more “debt-in-front” of them than Troves with lower interest rates. A Trove’s collateral ratio is not taken into account at all for redemption ordering.

- Unredeemable Troves. Redemptions now do not close Troves - they leave them open. Redemptions may now leave some Troves with a zero or very small BOLD debt < MIN_DEBT. These Troves are tagged as `unredeemable` in order to eliminate a redemption griefing attack vector. They become redeemable again when the borrower brings them back above the `MIN_DEBT`.


- Troves represented by NFTs. Troves are freely transferable and a given Ethereum address may own multiple Troves (by holding the corresponding NFTs).

- Individual delegation. A Trove owner may appoint an individual manager to set their interest rate.

- Batch delegation. A Trove owner may appoint a batch manager to manage their interest rate. A batch manager can adjust the interest rate of their batch within some predefined range (chosen by the batch manager at registration). A batch interest rate adjustment updates the interest rate for all Troves in the batch.

- Collateral branch shutdown. Under extreme negative conditions - i.e. sufficiently major collapse of the collateral market price, or an oracle failure - a collateral branch will be shut down. This entails freezing all borrower operations (except for closing of Troves), freezing interest accrual, and enabling “urgent” redemptions which have 0 redemption fee and even pay a slight collateral bonus to the redeemer. The intent is to clear as much debt from the branch as quickly as possible.

- **Removal of Recovery Mode**. The old Recovery Mode logic has been removed. Troves can only be liquidated when their collateral ratio (ICR) is below the minimum (MCR). However, some borrowing restrictions still apply below the critical collateral threshold (CCR) for a given branch.

- **Gas compensation**. Liquidations now pay gas compensation to the liquidator entirely in collateral. 

- **More flexibility for SP reward claiming**.. SP depositors can now claim or stash their LST gains from liquidations, and either claim their BOLD yield gains or add them to their deposit.

### What remains the same in v2 from v1?

- **Core redemption mechanism** - swaps 1 BOLD for $1 worth of collateral, less the fee, in order to maintain a hard BOLD price floor


- **Redemption fee mechanics at branch level**. The `baseRate` with fee spike based on redemption volume, and time-based decay.

- **Ordered Troves**. Each branch maintains a sorted list of Troves (though now ordered by annual interest rate)

- **Liquidation mechanisms**. Liquidated Troves are still offset against the BOLD in the SP and redistribution to active Troves in the branch if/when the SP deposits are insufficient.

- **Similar smart contract architecture** (at branch level).

- **Stability Pool algorithm**. Same arithmetic and logic is used for tracking deposits, collateral gains and BOLD yield gains over time as liquidations deplete the pool.

- **Individual overcollateralization**. Each Trove is individually overcollateralized and liquidated below the MCR

- **Aggregate (branch level ) overcollateralization.** Each branch is overcollateralized , measured by the TCR.


## Liquity v2 Overview

Liquity v2 is a collateralized debt platform. Users can lock up WETH and/or select LSTs, and issue stablecoin tokens (BOLD) to their own Ethereum address. The individual collateralized debt positions are called Troves.


The stablecoin tokens are economically geared towards maintaining value of 1 BOLD = $1 USD, due to the following properties:


1. The system is designed to always be over-collateralized - the dollar value of the locked collateral exceeds the dollar value of the issued stablecoins


2. The stablecoins are fully redeemable - users can always swap x BOLD for $x worth of a mix of WETH and LSTs (minus fees), directly with the system.


Upon  opening a Trove by depositing a viable collateral ERC20, users may issue ("borrow") BOLD tokens such that the collateralization ratio of their Trove remains above the minimum collateral ratio (MCR) for their collateral branch. For example, for an MCR of 110%, a user with $10000 worth of WETH in a Trove can issue up to 9090.90 BOLD against it.


The BOLD tokens are freely exchangeable - any Ethereum address can send or receive BOLD tokens, whether it has an open Trove or not. The BOLD tokens are burned upon repayment of a Trove's debt.


The Liquity v2 system prices collateral via Chainlink oracles.When a Trove falls below the MCR, it is considered under-collateralized, and is vulnerable to liquidation.


## Multicollateral Architecture Overview

The core Liquity contracts are organized in this manner:

- There is a single `CollateralRegistry`, a single `BoldToken`, and a set of core system contracts deployed for each collateral “branch”.

- A single `CollateralRegistry` maps external collateral ERC20 tokens to a `TroveManager` address. The `CollateralRegistry` also routes redemptions across the different collateral branches.


-An entire collateral branch is deployed for each LST collateral. A collateral branch contains all the logic necessary for opening and managing Troves, liquidating Troves, Stability Pool deposits, and redemptions (from that branch).

<img width="698" alt="image" src="https://github.com/user-attachments/assets/0d9c1fef-3edb-40bb-b991-d5c676b551dc">






## Borrowing and interest rates

When a Trove is opened, borrowers commit an amount of their chosen LST token as collateral, select their BOLD debt, and select an interest rate in range `[INTEREST_RATE_MIN, INTEREST_RATE_MAX]`.

Interest in Liquity v2 is **simple** interest and non-compounding - that is, for a given Trove debt, interest accrues linearly over time and proportional to its recorded debt.


Troves have a `recordedDebt` property which stores the Trove’s entire debt at the time it was last updated.

A Trove’s acrrued interest is calculated dynamically  as `d * period`

Where:

- `d` is recorded debt
- `period` is the time passed since the recorded debt was updated.


This is calculated in `TroveManager.calcTroveAccruedInterest`.

The getter `TroveManager.getTroveEntireDebt` incorporates all accrued interest into the final return value. All references to `entireDebt` in the code incorporate the Trove’s accrued Interest.

### Applying a Trove’s interest

Upon certain actions that touch the Trove, its accrued interest is calculated and added to its recorded debt. Its `lastUpdateTime`  property is then updated to the current time, which makes its accrued interest reset to 0.

The following actions apply a Trove’s interest:

- Borrower changes The Trove’s collateral or debt with `adjustTrove`
- Borrower adjusts the Trove’s interest rate with `adjustTroveInterestRate`
- Trove gets liquidated
- Trove gets redeemed
- Trove’s accrued interest is permissionlessly applied by anyone with `applyTroveInterestPermissionless`


### Interest rate scheme implementation

As well as individual Trove’s interest, we also need to track the total accrued interest in a branch, in order to calculate its total debt (in turn needed to calculate the TCR).


This must be done in a scalable way - and looping over Troves and summing their accrued interest would not be scalable.

To calculate total accrued interest, the Active Pool maintains two global tracker sums:
- `weightedRecordedDebtSum` 
- `aggRecordedDebt`

Along with a timekeeping variable  `lastDebtUpdateTime`


`weightedRecordedDebtSum` the sum of Troves’ debt weighted by their annual interest rate.

The aggregate pending interest at any given moment is given by 

`weightedRecordedDebtSum * period`

 where period is the time since the last update.

At most system operations, the `aggRecordedDebt` is updated - the pending aggregate interest is calculated and added to it, and the `lastDebtUpdateTime` is updated to now - thus resetting the aggregate pending interest.


[TODO - LINK ALGORITHM PAPER]

[TODO - IMPLEMENTATION PSEUDOCODE FROM GH ISSUE]

In practice, the implementation in code follows these steps but the exact sequence of operations is sometimes different due to other considerations (e.g. gas efficiency).

### Aggregate vs individual recorded debts

Importantly, the `aggRecordedDebt` does *not* always equal the sum of individual recorded Trove debts.

This is because the `aggRecordedDebt` is updated very regularly, whereas a given Trove’s recorded debt may not be.  When the `aggRecordedDebt` has been updated more recently than a given Trove, then it already includes that Trove’s accrued interest - because 

It’s best to think of the aggRecordedDebt and aggregate interest calculation running in parallel to the individual recorded debts and interest.

This example illustrates how it works.


[SPREADSHEET]

[DIAGRAM]

### Core debt invariant 

For a given branch, the system maintains the following invariant:

**Aggregate total debt of a always equals the sum of individual entire Trove debts**.

That is:

`ActivePool.aggRecordedDebt + ActivePool.calcPendingAggInterest() = SUM_i=1_n(TroveManager.getEntireTroveDebt())`

For all `n` Troves in the branch.

It can be shown mathematically that this holds (TBD).

### Applying and minting pending aggregate interest (i.e. yield)


Pending aggregate interest is “applied” upon most system actions. That is:

- The  `aggRecordedDebt` is updated - the pending aggregate interest is calculated and added to `aggRecordedDebt`, and the `lastDebtUpdateTime` is updated to now.

- The pending aggregate interest is minted by the ActivePool as fresh BOLD. This is considered system “yield”.  Part of it is iimmediately sent to the branch’s SP and split proportionally between depositors, and the remainder is sent to a router to be used as LP incentives on DEXes (determined by governance).

This is the only way BOLD is ever minted as interest. Applying individual interest to a Trove updates its recorded debt, but does not actually mint new BOLD tokens.

### Interest rate adjustments, redemption evasion mitigation 

A borrower may adjust their Trove’s interest rate at any time.

Since redemptions are performed in order of Troves’ user-set interest rates, a “premature adjustment fee” mechanism exists to prevent redemption evasion. Without it, low-interest rate borrowers could evade redemptions by sandwiching a redemption transaction with both an upward and downward interest rate adjustment.

The premature adjustment fee works as so:

- When a Trove is opened, its `lastInterestRateAdjTime` property is set equal to the current time
- When a borrower adjusts their interest rate via `adjustTroveInterestRate` the system checks that the cooldown period has passed since their last interest rate adjustment 

- If the adjustment is sooner, it incurs an upfront fee which is added to their debt.

## BOLD Redemptions

Any BOLD holder (whether or not they have an active Trove) may redeem their BOLD directly with the system. Their BOLD is exchanged for a mixture of collaterals at face value: redeeming 1 BOLD token returns $1 worth of collaterals (minus a dynamic redemption fee), priced at their current market values according to their respective oracles. Redemptions have two purposes:


1. When BOLD is trading at <$1 on the external market, arbitrageurs may redeem `$x` worth of BOLD for `>$x` worth of collaterals, and instantly sell those collaterals to make a profit. This reduces the circulating supply of BOLD which in turn should help restore the $1 BOLD peg.


2. Redemptions improve the relative health of the least healthy collateral branches (those with greater unbacked debt).


## Redemption routing

[TODO - ROUTING DIAGRAM]

Redemptions are performed via the `CollateralRegistry.redeemCollateral` endpoint. A given redemption may be routed across several collateral branches.

A given BOLD redemption is split across branches according in proportion to the **unbacked debt** of that branch, i.e. (pseudocode):

`redeem_amount_i = unbacked_debt_i / total_unbacked_debt`

Where `unbacked_debt_i` for branch i is given by `total_bold_debt_i  - bold_in_SP_i`.

That is, a redemption reduces the unbacked debt on each branch by the same percentage.

_Example: 2000 BOLD is redeemed across 4 branches_

[TABLE - BRANCH REDEMPTION]

<img width="704" alt="image" src="https://github.com/user-attachments/assets/21afcc49-ed50-4f3e-8b36-1949cd7a3809">



[TODO - GRAPH BRANCH REDEMPTION]


## Redemptions at branch level

When BOLD is redeemed for collaterals, the system cancels the BOLD with debt from Troves, and the corresponding collateral is removed.

In order to fulfill the redemption request on a given branch, Troves are redeemed from in ascending order of their annual interest rates.

A redemption sequence of n steps will fully redeem all debt from the first n-1 Troves, and, and potentially partially redeem from the final Trove in the sequence.


Redemptions are skipped for Troves with ICR  < 100%. This is to ensure that redemptions improve the ICR of the Trove.

### Redemption fees

The redemption fee mechanics are broadly the same as in Liquity v1. The redemption fee is taken as a cut of the total ETH drawn from the system in a redemption. It is based on the current redemption rate.

The fee percentage is calculated in the `CollateralRegistry`, and then applied to each branch.

### Rationale for fee schedule


The larger the redemption volume, the greater the fee percentage applied to that redemption.

The longer the time delay since the last redemption, the more the `baseRate` decreases.

The intent is to throttle large redemptions with higher fees, and to throttle further redemptions immediately after large redemption volumes. The `baseRate` decay over time ensures that the fee will “cool down”, while redemptions volumes are low.

Furthermore, the fees cannot become smaller than the fee floor of 0.5%, which somewhat mitigates arbitrageurs frontrunning Chainlink oracle price updates with redemption transactions.

The redemption fee (red line) should follow this dynamic over time as redemptions occur (blue bars).

[REDEMPTION COOLDOWN GRAPH]

<img width="703" alt="image" src="https://github.com/user-attachments/assets/810fff65-3fd0-41fb-9810-c6940f143aa3">



### Fee Schedule

Redemption fees are based on the `baseRate` state variable in `CollateralRegistry`, which is dynamically updated. The `baseRate` increases with each redemption, and exponentially decays according to time passed since the last redemption.


The current fee schedule:

Upon each redemption of x BOLD:

`baseRate` is decayed based on time passed since the last fee event
`baseRate` is incremented by an amount proportional to the fraction of the total BOLD supply to be redeemed, i.e. `x/total_bold_supply`

The redemption fee percentage is given by `min{REDEMPTION_FEE_FLOOR + baseRate , 1}`.

### Redemption fee decay


When the `baseRate` is elevated above the fee floor - e.g. after a redemption happens - it exponentially decays back down to the fee floor.

### Redemption fee during bootstrapping period

At deployment, the `baseRate` is set to `INITIAL_REDEMPTION_RATE`, which is some sizable value e.g. 5%  - exact value TBD. It then decays as normal over time.

The intention is to discourage early redemptions in the early days when the total system debt is small, and give it time to grow.


## Unredeemable Troves

In Liquity v2, redemptions do not close Troves (unlike v1).

**Rationale for leaving Troves open**: Troves are now ordered by interest rate rather than ICR, and so (unlike v1) it is now possible to redeem Troves with ICR > TCR.  If such Troves were closed upon redemption, then redemptions may lower the TCR - this would be an economic risk / attack vector.

Hence redemptions in v2 always leave Troves open. This ensures that normal redemptions never lower the TCR* of a branch.

**Need for unredeemable Troves**: Leaving Troves open at redemption means redemptions may result in Troves with very small (or zero) `debt < MIN_DEBT`.  This could create a griefing risk - by creating many Troves with tiny `debt < MIN_DEBT` at the minimum interest rate, an attacker could “clog up” the bottom of the sorted list of Troves, and future redemptions would hit many Troves without redeeming much BOLD, or even be unprofitable due to gas costs.

Therefore, when a Trove is redeemed to below MIN_DEBT, it is tagged as unredeemable and removed from the sorted list.  

When a borrower touches their unredeemable Trove, they must either bring it back to `debt > MIN_DEBT`, or close it. Adjustments that leave it with insufficient debt are not possible.

Pending debt gains from redistributions and accrued interest can bring the Trove's debt above `MIN_DEBT`, but these pending gains don't make the Trove redeemable again. Only the borrower can do that when they adjust it and leave their recorded `debt > MIN_DEBT`.

### Full unredeemable Troves logic

When a Trove is redeemed down to `debt < MIN_DEBT`, we:
- Change its status to `unredeemable`
- Remove it from the SortedTroves list
- _Don't_ remove it from the `TroveManager.Troves` array since this is only used for off-chain hints (also this saves gas for the borrower for future Trove touches)


Unredeemable Troves:


- Can not be redeemed
- Can be liquidated
- Do receive redistribution gains
- Do accrue interest
- Can have their accrued interest permissionlessly applied
- Can not have their interest rate changed by their owner
- Can not be adjusted such that they're left with debt <`MIN_DEBT` by owner
- Can be closed by their owner
- Can be brought above MIN_DEBT by owner (which re-adds them to the Sorted Troves list, and changes their status back to 'Active')

_(*as long as TCR > 100%. If TCR < 100%, then normal redemptions would lower the TCR, but the shutdown threshold is set above 100%, and therefore the branch would be shut down first. See the shutdown section [LINK].)_


## Stability Pool implementation

BOLD depositors in the Stability Pool on a given branch earn:

- BOLD yield paid from interest minted on Troves on that branch
- Collateral gains from liquidated Troves on that branch


Depositors deposit BOLD to the SP via `provideToSP` and withdraw it with `withdrawFromSP`. 

Their accumulated collateral gains and BOLD yield gains are calculated every time they touch their deposit - i.e. at top up or withdrawal. If the depositor chooses to withdraw gains (via the `doClaim` bool param), all their collateral and BOLD yield gain are sent to their address.

Otherwise, their collateral gain is stashed in a tracked balance and their BOLD yield gain is added to their deposit.



### How deposits and ETH gains are calculated


The SP use a scalable method of tracking deposits, collateral and yield gains which has O(1) complexity - i.e. constant gas cost regardless of the number of depositors. 

It is the same Product-Sum algorithm from Liquity v1.


### Collateral gains from Liquidations and the Product-Sum algorithm

When a liquidation occurs, rather than updating each depositor’s deposit and collateral and yield gain, we simply update two global tracker variables: a product `P`, a sum `S` corresponding to the collateral gain.

A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors’ compounded deposits and accumulated collateral gains over time, as liquidations occur, using just these two variables. When depositors join the Stability Pool, they get a snapshot of `P` and `S`.

The formula for a depositor’s accumulated collateral gain is derived here:

[LINK PAPER]

### Scalable reward distribution for compounding, decreasing stake

Each liquidation updates `P` and `S`. After a series of liquidations, a compounded deposit and corresponding ETH gain can be calculated using the initial deposit, the depositor’s snapshots, and the current values of `P` and `S`.

Any time a depositor updates their deposit (withdrawal, top-up) their collateral gain is paid out, and they receive new snapshots of `P` and `S`.

This is similar in spirit to the Scalable Reward Distribution on the Ethereum Network by Bogdan Batog et al (i.e. the standard UniPool algorithm), however, the arithmetic is more involved as it handles a compounding, decreasing stake along with a corresponding collateral gain.

### BOLD Yield Gains

BOLD yield gains for Stability Pool depositors are triggered whenever the ActivePool mints aggregate system interest - that is, upon most system operations. The BOLD yield gain is minted to the Stability Pool and a BOLD gain for all depositors is triggered in proportion to their deposit size.

To efficiently and accurately track BOLD yield gains for depositors as deposits decrease over time from liquidations, we re-use the above product-sum algorithm for deposit and gains.


The same product `P` is used, and a sum `B` is used to track BOLD yield gains. Each deposit gets a new snapshot of `B` when it is updated.

### TODO -  mention P Issue fix

## TODO - Contracts list

## TODO - Public functions list 

## TODO - Liquidations (largely as per v1, focus on redistribution gains)

## TODO - Delegation of interest rate management

## TODO - Oracles
### Oracle architecture and rationale
### Oracle logic
### Mitigations

## TODO - Collateral branch shutdown
### Urgent redemptions

## TODO - Known issues and mitigations
### Oracle frontrunning
### LST and oracle risks 



## Requirements

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Setup

```sh
git clone git@github.com:liquity/bold.git
cd bold
pnpm install
```

## How to develop

```sh
# Run the anvil local node (keep it running in a separate terminal):
anvil

# First, the contracts:
cd contracts

# Build & deploy the contracts:
./deploy local --open-demo-troves # optionally open troves for the first 8 anvil accounts

# Print the addresses of the deployed contracts:
pnpm tsx utils/deployment-artifacts-to-app-env.ts deployment-context-latest.json

# We are now ready to pass the deployed contracts to the app:
cd ../frontend

# Copy the example .env file:
cp .env .env.local

# Edit the .env.local file:
#  - Make sure the Hardhat / Anvil section is uncommented.
#  - Copy into it the addresses printed by command above.

# Run the app development server:
pnpm dev

# You can now open https://localhost:3000 in your browser.
```
