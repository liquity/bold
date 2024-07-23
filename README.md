# Liquity v2

## Significant changes in Liquity v2

- **Multi-collateral system.** The system now consists of a CollateralRegistry and multiple collateral branches. Each collateral branch is parameterized separately with its own Minimum Collateral Ratio (MCR), Critical Collateral Ratio (CCR) and Shutdown Collateral Ratio (SCR). Each collateral branch contains its own TroveManager and StabilityPool. Troves in a given branch only accept a single collateral (never mixed collateral). Liquidations of Troves in a given branch via SP offset are offset purely against the SP for that branch, and liquidation gains for SP depositors are always paid in a single collateral. Similarly, liquidations via redistribution split the collateral and debt across purely active Troves in that branch.
 
- **Collateral choices.** The system will contain collateral branches for WETH and several LSTs: rETH, wstETH and either one (or both) of osETH and ETHx (TBD). It does not accept native ETH as collateral.

- **User-set interest rates.** When a borrower opens a Trove, they choose their own annual interest rate. They may change their annual interest rate at any point. Simple (non-compounding) interest accrues on their debt continuously, and gets compounded discretely every time the Trove is touched. Aggregate accrued Trove debt is periodically minted as BOLD. 

- **Yield from interest paid to SP and LPs.** BOLD yields from Trove interest are periodically paid out in a split to the Stability Pool (SP), and to a router which in turn routes its yield share to DEX LP incentives.  Yield paid to the SP from Trove interest on a given branch is always paid to the SP on that same branch.

- **Redemption routing.** Redemptions of BOLD are routed by the CollateralRegistry. For a given redemption, the redemption volume that hits a given branch is proportional to its relative “unbackedness”. The primary goal of redemptions is to restore the BOLD peg. A secondary purpose is to reduce the unbackedness of the most unbacked branches relatively more than the more backed branches. Unbackedness is defined as the delta between the total BOLD debt of the branch, and the BOLD in the branch’s SP.

- **Redemption ordering.** In a given branch, redemptions hit Troves in order of their annual interest rate, from lowest to highest. Troves with higher annual interest rates are more shielded from redemptions - they have more “debt-in-front” of them than Troves with lower interest rates. A Trove’s collateral ratio is not taken into account at all for redemption ordering.

- **Unredeemable Troves.** Redemptions now do not close Troves - they leave them open. Redemptions may now leave some Troves with a zero or very small BOLD debt < MIN_DEBT. These Troves are tagged as `unredeemable` in order to eliminate a redemption griefing attack vector. They become redeemable again when the borrower brings them back above the `MIN_DEBT`.

- **Troves represented by NFTs.** Troves are freely transferable and a given Ethereum address may own multiple Troves (by holding the corresponding NFTs).

- **Individual delegation.** A Trove owner may appoint an individual manager to set their interest rate and/or control debt and collateral adjustments.

- **Batch delegation.** A Trove owner may appoint a batch manager to manage their interest rate. A batch manager can adjust the interest rate of their batch within some predefined range (chosen by the batch manager at registration). A batch interest rate adjustment updates the interest rate for all Troves in the batch in a gas-efficient manner.

- **Collateral branch shutdown.** Under extreme negative conditions - i.e. sufficiently major collapse of the collateral market price, or an oracle failure - a collateral branch will be shut down. This entails freezing all borrower operations (except for closing of Troves), freezing interest accrual, and enabling “urgent” redemptions which have 0 redemption fee and even pay a slight collateral bonus to the redeemer. The intent is to clear as much debt from the branch as quickly as possible.

- **Removal of Recovery Mode**. The old Recovery Mode logic has been removed. Troves can only be liquidated when their collateral ratio (ICR) is below the minimum (MCR). However, some borrowing restrictions still apply below the critical collateral threshold (CCR) for a given branch.

-**Liquidation penalties**. Liquidated borrowers now no longer always lose their entire collateral in a liquidation. Depending on the collateral branch and liquidation type, they may be able to reclaim a small remainder.

- **Gas compensation**. Liquidations now pay gas compensation to the liquidator in a mix of collateral and WETH. The liquidation reserve is denominated in WETH irrespective of the collateral plus a variable compensation in the collateral, which is capped to avoid excessive compensations. 

- **More flexibility for SP reward claiming**.. SP depositors can now claim or stash their LST gains from liquidations, and either claim their BOLD yield gains or add them to their deposit.

### What remains the same in v2 from v1?

- **Core redemption mechanism** - swaps 1 BOLD for $1 worth of collateral, less the fee, in order to maintain a hard BOLD price floor


- **Redemption fee mechanics at branch level**. The `baseRate` with fee spike based on redemption volume, and time-based decay.

- **Ordered Troves**. Each branch maintains a sorted list of Troves (though now ordered by annual interest rate)

- **Liquidation mechanisms**. Liquidated Troves are still offset against the BOLD in the SP and redistribution to active Troves in the branch if/when the SP deposits are insufficient (though the liquidation penalty applied to the borrower is reduced).

-**Similar smart contract architecture**. At branch level the system architecture closely resembles that of v1 - the `TroveManager`, `BorrowerOperations` and `StabilityPool` contracts contain most system logic and direct the flows of BOLD and collateral.

- **Similar smart contract architecture** (at branch level).

- **Stability Pool algorithm**. Same arithmetic and logic is used for tracking deposits, collateral gains and BOLD yield gains over time as liquidations deplete the pool.

- **Individual overcollateralization**. Each Trove is individually overcollateralized and liquidated below the branch-specific MCR.

- **Aggregate (branch level ) overcollateralization.** Each branch is overcollateralized , measured by the respective TCR.


## Liquity v2 Overview

Liquity v2 is a collateralized debt platform. Users can lock up WETH and/or select LSTs, and issue stablecoin tokens (BOLD) to their own Ethereum address. The individual collateralized debt positions are called Troves.


The stablecoin tokens are economically geared towards maintaining value of 1 BOLD = $1 USD, due to the following properties:


1. The system is designed to always be over-collateralized - the dollar value of the locked collateral exceeds the dollar value of the issued stablecoins


2. The stablecoins are fully redeemable - users can always swap x BOLD for $x worth of a mix of WETH and LSTs (minus fees), directly with the system.
   
3. The system incorporates an adaptive interest rate mechanism, managing the attractiveness and thus the demand for holding and borrowing the stablecoin in a market-driven way.  


Upon  opening a Trove by depositing a viable collateral ERC20, users may issue ("borrow") BOLD tokens such that the collateralization ratio of their Trove remains above the minimum collateral ratio (MCR) for their collateral branch. For example, for an MCR of 110%, a user with $10000 worth of WETH in a Trove can issue up to 9090.90 BOLD against it.


The BOLD tokens are freely exchangeable - any Ethereum address can send or receive BOLD tokens, whether it has an open Trove or not. The BOLD tokens are burned upon repayment of a Trove's debt.


The Liquity v2 system prices collateral via Chainlink oracles.When a Trove falls below the MCR, it is considered under-collateralized, and is vulnerable to liquidation.


## Multicollateral Architecture Overview

The core Liquity contracts are organized in this manner:

- There is a single `CollateralRegistry`, a single `BoldToken`, and a set of core system contracts deployed for each collateral “branch”.

- A single `CollateralRegistry` maps external collateral ERC20 tokens to a `TroveManager` address. The `CollateralRegistry` also routes redemptions across the different collateral branches.


-An entire collateral branch is deployed for each LST collateral. A collateral branch contains all the logic necessary for opening and managing Troves, liquidating Troves, Stability Pool deposits, and redemptions (from that branch).

<img width="731" alt="image" src="https://github.com/user-attachments/assets/b7fd9a4f-353b-4b1a-b32f-0abf0b8c0405">

## Core System Contracts



### Top level contracts

- `CollateralRegistry` - Records all LST collaterals and maps branch-level TroveManagers to LST collaterals. Calculates redemption fees and routes BOLD redemptions to the TroveManagers of different branches in proportion to their “outside” debt.

- `BOLDToken` - the stablecoin token contract, which implements the ERC20 fungible token as well as EIP-2612 permit functionality. The contract mints, burns and transfers BOLD tokens.

### Branch-level contracts

The three main branch-level contracts - `BorrowerOperations`, `TroveManager` and `StabilityPool` - hold the user-facing public functions, and contain most of the internal system logic.

- `BorrowerOperations`- contains the basic operations by which borrowers and managers interact with their Troves: Trove creation, collateral top-up / withdrawal, BOLD issuance and repayment, and interest rate adjustments. BorrowerOperations functions call in to TroveManager, telling it to update Trove state where necessary. BorrowerOperations functions also call in to the various Pools, telling them to move collateral/BOLD between Pools or between Pool <> user, where necessary, and it also tells the ActivePool to mint interest.

- `TroveManager` - contains functionality for liquidations and redemptions and calculating individual Trove interest. Also contains the recorded  state of each Trove - i.e. a record of the Trove’s collateral, debt and interest rate, etc. TroveManager does not hold value (i.e. collateral or BOLD). TroveManager functions call in to the various Pools to tell them to move collateral or BOLD between Pools, where necessary.

- `LiquityBase` - Contains common functions and is inherited by `CollateralRegistry`, `TroveManager`, `BorrowerOperations`, `StabilityPool`. 

- `StabilityPool` - contains functionality for Stability Pool operations: making deposits, and withdrawing compounded deposits and accumulated collateral and BOLD yield gains. Holds the BOLD Stability Pool deposits, BOLD yield gains and collateral gains from liquidations for all depositors on that branch.

- `SortedTroves` - a doubly linked list that stores addresses of Trove owners, sorted by their annual interest rate. It inserts and re-inserts Troves at the correct position, based on their interest rate. It also contains logic for inserting/re-inserting entire batches of Troves, modelled as doubly linked-list slices.

- `ActivePool` - holds the branch collateral balance and records the total BOLD debt of the active Troves in the branch. Mints aggregate interest in a split to the StabilityPool as well as a (to-be) yield router for DEX LP incentives (currently, to MockInterestRouter)

- `DefaultPool` - holds the total collateral balance and records the total BOLD debt of the liquidated Troves that are pending redistribution to active Troves. If an active Trove has pending collateral and debt “rewards” in the DefaultPool, then they will be applied to the Trove when it next undergoes a borrower operation, a redemption, or a liquidation.

- `CollSurplusPool` - holds and tracks the collateral surplus from Troves that have been liquidated. Sends out a borrower’s accumulated collateral surplus when they claim it. 

- `GasPool` - holds the total WETH gas compensation. WETH is transferred from the borrower to the GasPool when a Trove is opened, and transferred out when a Trove is liquidated or closed.

- `MockInterestRouter` - Dummy contract that receives the LP yield split of minted interest. To be replaced with the real yield router that directs yield to DEX LP incentives.


### Peripheral helper contracts

- `HintHelpers` - Helper contract, containing the read-only functionality for calculation of accurate hints to be supplied to borrower operations.

- `MultiTroveGetter` - Helper contract containing read-only functionality for fetching arrays of Trove data structs which contain the complete recorded state of a Trove.

### Mainnet PriceFeed contracts

Different PriceFeed contracts are needed for pricing collaterals on different branches, since the price calculation methods differ across LSTs (see the Oracle section) [LINK]. However, much of the functionality is common to a couple of parent contracts.

- `MainnetPriceFeedBase` - Base contract that contains functionality for fetching prices from external Chainlink (and possibly Redstone) push oracles, verifying the responses, and triggering collateral branch shutdown in case of an oracle failure.


- `CompositePriceFeed` - Base contract that inherits `MainnetPriceFeedBase` and contains functionality for fetching prices from two market oracles: LST-ETH and ETH-USD, and calculating a composite LST- USD `market_price`. It also fetches the LST contract’s LST-ETH exchange rate, calculates a composite LST-USD `exchange_rate_price` and the final LST-USD price returned is `min(market_price, exchange_rate_price)`.

- `WETHPriceFeed` Inherits `MainnetPriceFeedBase`. Fetches the ETH-USD price from a Chainlink push oracle. Used to price collateral on the WETH branch.

- `WSTETHPriceFeed` - Inherits `MainnetPriceFeedBase`. Fetches the STETH-USD price from a Chainlink push oracle, and computes WSTETH-USD price from the STETH-USD price the WSTETH-STETH exchange rate from the LST contract. Used to price collateral on a WSTETH branch.

- `RETHPriceFeed` - Inherits `CompositePriceFeed` and fetches the specific RETH-ETH exchange rate from RocketPool’s RETHToken. Used to price collateral on a RETH branch.

- `ETHXPriceFeed` - Inherits `CompositePriceFeed` and fetches the specific ETHX-ETH exchange rate from Stader’s deployed StaderOracle on mainnet. Used to price collateral on an ETHX branch.

- `OSETHPricFeed` - Inherits `CompositePriceFeed` and fetches the specific OSETH-ETH exchange rate from Stakewise’s deployed OsTokenVaultController contract. Used to price collateral on an OSETH branch.


## Public state-changing functions

### CollateralRegistry


- `redeemCollateral(uint256 _boldAmount, uint256 _maxIterations, uint256 _maxFeePercentage)`: redeems `_boldAmount` of BOLD tokens from the system in exchange for a mix of collaterals. Splits the BOLD redemption according to the redemption routing logic [LINK], redeems from a number of Troves in each collateral branch, burns `_boldAmount` from the caller’s BOLD balance, and transfers each redeemed collateral amount to the redeemer. Executes successfully if the caller has sufficient BOLD to redeem. The number of Troves redeemed from per branch is capped by `_maxIterationsPerCollateral`. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept which mitigates fee slippage, i.e. when another redemption transaction is processed first and drives up the redemption fee.  Troves left with `debt < MIN_DEBT` are flagged as `unredeemable`.

### BorrowerOperations

- `openTrove(
        address _owner,
        uint256 _ownerIndex,
        uint256 _collAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee
    )`: creates a Trove for the caller that is not part of a batch. Transfers `_collAmount` from the caller to the system, mints `_boldAmount` of BOLD to their address. Mints the Trove NFT to their address. The `ETH_GAS_COMPENSATION` of 0.0375 WETH is transferred from the caller to the GasPool. Opening a Trove must result in the Trove’s ICR > MCR, and also the system’s TCR > CCR. An `upfrontFee` is charged, based on the system’s _average_ interest rate, the BOLD debt drawn and the `UPFRONT_INTEREST_PERIOD`. The borrower chooses a `_maxUpfrontFee` that he/she is willing to accept in case of a fee slippage, i.e. when the system’s average interest rate increases and in turn increases the fee they’d pay.


- `openTroveAndJoinInterestBatchManager(
        address _owner,
        uint256 _ownerIndex,
        uint256 _collAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        address _interestBatchManager,
        uint256 _maxUpfrontFee
    )`: creates a Trove for the caller and adds it to the chosen `_interestBatchManager`’s batch. Transfers `_collAmount` from the caller to the system and mints `_boldAmount` of BOLD to their address.  Mints the Trove NFT to their address. The `ETH_GAS_COMPENSATION` of 0.0375 WETH is transferred from the caller to the GasPool. Opening a batch Trove must result in the Trove’s ICR >= MCR, and also the system’s TCR >= CCR. An `upfrontFee` is charged, based on the system’s _average_ interest rate, the BOLD debt drawn and the `UPFRONT_INTEREST_PERIOD`. The fee is added to the Trove’s debt. The borrower chooses a `_maxUpfrontFee` that he/she is willing to accept in case of a fee slippage, i.e. when the system’s average interest rate increases and in turn increases the fee they’d pay.

- `addColl(uint256 _troveId, uint256 _collAmount)`: Transfers the `_collAmount` from the user to the system, and adds the received collateral to the caller's active Trove.

- `withdrawColl(uint256 _troveId, uint256 _amount)`: withdraws _amount of collateral from the caller’s Trove. Executes only if the user has an active Trove, must result in the user’s Trove `ICR >= MCR` and must obey the adjustment CCR constraints [LINK].

 - `withdrawBold(uint256 _troveId, uint256 _amount, uint256 _maxUpfrontFee)`: adds _amount of BOLD to the user’s Trove’s debt, mints BOLD stablecoins to the user. Must result in `ICR >= MCR` and must obey the adjustment CCR constraints [LINK]. An `upfrontFee` is charged, based on the system’s _average_ interest rate, the BOLD debt drawn and the `UPFRONT_INTEREST_PERIOD`. The fee is added to the Trove’s debt. The borrower chooses a `_maxUpfrontFee` that he/she is willing to accept in case of a fee slippage, i.e. when the system’s average interest rate increases and in turn increases the fee they’d pay.	

 - `repayBold(uint256 _troveId, uint256 _amount)`: repay `_amount` of BOLD to the caller’s Trove, canceling that amount of debt. Transfers the BOLD from the caller to the system.

 - `closeTrove(uint256 _troveId)`: repays all debt in the user’s Trove, withdraws all their collateral to their address, and closes their Trove. Requires the borrower have a BOLD balance sufficient to repay their Trove's debt. Burns the BOLD from the user’s address.

- `adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _maxUpfrontFee
    )`:  enables a borrower to simultaneously change both their collateral and debt, subject to the resulting `ICR >= MCR` and the adjustment CCR constraints [LINK]. If the adjustment incorporates a `debtIncrease`, then an `upfrontFee` is charged as per `withdrawBold`.


- `adjustUnredeemableTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )` - enables a borrower with a unredeemable Trove to adjust it. Any adjustment must result in the Trove’s `debt > MIN_DEBT` and `ICR > MCR`, along with the usual borrowing CCR constraints [LINK]. The adjustment reinserts it to its previous batch, if it had one.

- `claimCollateral()`: Claims the caller’s accumulated collateral surplus gains from their liquidated Troves which were left with a collateral surplus after collateral seizure at liquidation.  Sends the accumulated collateral surplus to the caller and zeros their recorded balance.

- `shutdown()`: Shuts down the entire collateral branch. Only executes if the TCR < SCR, and it is not already shut down. Mints the final chunk of aggregate interest for the branch, and flags it as shut down.

- `adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )`: Change’s the caller’s annual interest rate on their Trove. The update is considered “premature” if they’ve recently changed their interest rate (i.e. within `INTEREST_RATE_ADJ_COOLDOWN` seconds), and if so, they incur an upfront fee (see the interest rate adjustment section [LINK]).  The fee is also based on the system average interest rate, so the user may provide a `_maxUpfrontFee` if they make a premature adjustment.

- `applyTroveInterestPermissionless(uint256 _troveId, uint256 _lowerHint, uint256 _upperHint)`: Applies the Trove’s accrued interest, i.e. adds the accrued interest to its recorded debt and updates its `lastDebtUpdateTime` to now. The purpose is to make sure all Troves can have their interest applied with sufficient regularity even if their owner doesn’t touch them. Also makes unredeemable Troves that have reached `debt > MIN_DEBT` (e.g. from interest or redistribution gains) become redeemable again, by reinserting them to the SortedList and previous batch (if they were in one).

-  `setAddManager(uint256 _troveId, address _manager)`: sets an “Add” manager for the caller’s chosen Trove, who has permission to add collateral and repay debt to their Trove.

-  `setRemoveManager(uint256 _troveId, address _manager)`: sets a “Remove” manager for the caller’s chosen Trove, who has permission to remove collateral from and draw new BOLD from their Trove.

- `setRemoveManager(uint256 _troveId, address _manager, address _receiver)`: sets a “Remove” manager for the caller’s chosen Trove, who has permission to remove collateral from and draw new BOLD from their Trove to the provided `_receiver` address.

- `setInterestIndividualDelegate(
        uint256 _troveId,
        address _delegate,
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )`: the Trove owner sets an individual delegate who will have permission to update the interest rate for that Trove in range `[ _minInterestRate,  _minInterestRate]`.  Removes the Trove from a batch if it was in one. 

- `removeInterestIndividualDelegate(uint256 _troveId):` the Trove owner revokes individual delegate’s permission to change the given Trove’s interest rate. 

- `registerBatchManager(
        uint128 minInterestRate,
        uint128 maxInterestRate,
        uint128 currentInterestRate,
        uint128 fee,
        uint128 minInterestRateChangePeriod
    )`: registers the caller’s address as a batch manager, with their chosen min and max interest rates for the batch. Sets the `currentInterestRate` for the batch and the annual `fee`, which is charged as a percentage of the total debt of the batch. The `minInterestRateChangePeriod` determines how often the batch manager will be able to change the batch’s interest rates going forward.
   
- `lowerBatchManagementFee(uint256 _newAnnualFee)`: reduces the annual batch management fee for the caller’s batch. Mints accrued interest and accrued management fees to-date.

- `setBatchManagerAnnualInterestRate(
        uint128 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )`: sets the annual interest rate for the caller’s batch. Executes only if the `minInterestRateChangePeriod` has passed.  Applies an upfront fee on premature adjustments, just like individual Trove interest rate adjustments. Mints accrued interest and accrued management fees to-date.


- `setInterestBatchManager(
        uint256 _troveId,
        address _newBatchManager,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )`: Trove owner sets a new `_newBatchManager` to control their Trove’s interest rate and inserts it to the chosen batch. The `_newBatchManager` must already be registered. Since this action very likely changes the Trove’s interest rate, it’s subject to a premature adjustment fee as per regular adjustments.


- `removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )`: revokes the batch manager’s permission to manage the caller’s Trove. Sets a new owner-chosen annual interest rate, and removes it from the batch. Since this action very likely changes the Trove’s interest rate, it’s subject to a premature adjustment fee as per regular adjustments.

- `applyBatchInterestAndFeePermissionless(address _batchAddress)`:  Applies the batch’s accrued interest and management fee to the batch.

### TroveManager

- `liquidate(uint256 _troveId)`: attempts to liquidate the specified Trove. Executes successfully if the Trove meets the conditions for liquidation, i.e. ICR < MCR. Permissionless.


- `batchLiquidateTroves(uint256[] calldata _troveArray)`: Accepts a custom list of Troves IDs as an argument. Steps through the provided list and attempts to liquidate every Trove, until it reaches the end or it runs out of gas. A Trove is liquidated only if it meets the conditions for liquidation, i.e. ICR < MCR. Troves with ICR >= MCR are skipped in the loop. Permissionless.


- `urgentRedemption(uint256 _boldAmount, uint256[] calldata _troveIds, uint256 _minCollateral)`: Executes successfully only when the collateral branch has already been shut down.  Redeems only from the branch it is called on. Redeems from Troves with a slight collateral bonus - that is, 1 BOLD redeems for $1.01 worth of LST collateral.  Does not flag any redeemed-from Troves as `unredeemable`. Caller specifies the `_minCollateral` they want to receive.

### StabilityPool

- `provideToSP(uint256 _amount, bool _doClaim)`: deposit _amount of BOLD to the Stability Pool. It transfers _amount of LUSD from the caller’s address to the Pool, and tops up their BOLD deposit by _amount. `doClaim` determines how the depositor’s existing collateral and BOLD yield gains (if any exist) are treated: if true they’re transferred to the depositor’s address, otherwise the collateral is stashed (added to a balance tracker) and the BOLD gain is added to their deposit.

- `withdrawFromSP(uint256 _amount, bool doClaim)`: withdraws _amount of BOLD from the Stability Pool, up to the value of their remaining deposit. It increases their BOLD balance by _amount. If the user makes a partial withdrawal, their remaining deposit will earn further liquidation and yield gains.  `doClaim` determines how the depositor’s existing collateral and BOLD yield gains (if any exist) are treated: if true they’re transferred to the depositor’s address, otherwise the collateral is stashed (added to a balance tracker) and the BOLD gain is added to their deposit.


- `claimAllCollGains()`: Sends all stashed collateral gains to the caller and zeros their stashed balance. Used only when the caller has no current deposit yet has stashed collateral gains from the past.

### All PriceFeeds

`fetchPrice()`:  Permissionless. Tells the PriceFeed to fetch price answers from oracles, and if necessary calculates the final derived LST-USD price. Checks if any oracle used has failed (i.e. if it reverted, returned a stale price, or a 0 price). If so, shuts the collateral branch down. Otherwise, stores the fetched price as `lastGoodPrice`. 

### BOLDToken

Standard ERC20 and EIP2612 (`permit()` ) functionality.



## Borrowing and interest rates

When a Trove is opened, borrowers commit an amount of their chosen LST token as collateral, select their BOLD debt, and select an interest rate in range `[INTEREST_RATE_MIN, INTEREST_RATE_MAX]`.

Interest in Liquity v2 is **simple** interest and non-compounding - that is, for a given Trove debt, interest accrues linearly over time and proportional to its recorded debt as long as the Trove isn’t altered.


Troves have a `recordedDebt` property which stores the Trove’s entire debt at the time it was last updated.

A Trove’s accrued interest is calculated dynamically  as `d * period`

Where:

- `d` is recorded debt
- `period` is the time passed since the recorded debt was updated.


This is calculated in `TroveManager.calcTroveAccruedInterest`.

The getter `TroveManager.getTroveEntireDebt` incorporates all accrued interest into the final return value. All references to `entireDebt` in the code incorporate the Trove’s accrued Interest.

### Applying a Trove’s interest

Upon certain actions that touch the Trove, its accrued interest is calculated and added to its recorded debt. Its `lastUpdateTime`  property is then updated to the current time, which makes its accrued interest reset to 0.

The following actions apply a Trove’s interest:

- Borrower or manager changes The Trove’s collateral or debt with `adjustTrove`
- Borrower or manager adjusts the Trove’s interest rate with `adjustTroveInterestRate`
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


`weightedRecordedDebtSum` tracks the sum of Troves’ debts weighted by their respective annual interest rates.

The aggregate pending interest at any given moment is given by 

`weightedRecordedDebtSum * period`

 where period is the time since the last update.

At most system operations, the `aggRecordedDebt` is updated - the pending aggregate interest is calculated and added to it, and the `lastDebtUpdateTime` is updated to now - thus resetting the aggregate pending interest.


[TODO - LINK ALGORITHM PAPER]

[TODO - IMPLEMENTATION PSEUDOCODE FROM GH ISSUE]

In practice, the implementation in code follows these steps but the exact sequence of operations is sometimes different due to other considerations (e.g. gas efficiency).

### Aggregate vs individual recorded debts

Importantly, the `aggRecordedDebt` does *not* always equal the sum of individual recorded Trove debts.

This is because the `aggRecordedDebt` is updated very regularly, whereas a given Trove’s recorded debt may not be.  When the `aggRecordedDebt` has been updated more recently than a given Trove, then it already includes that Trove’s accrued interest - because when it is updated, _all_ Trove's accrued pending interest is added to it.

It’s best to think of the `aggRecordedDebt` and aggregate interest calculation running in parallel to the individual recorded debts and interest.

This example illustrates how it works.


[SPREADSHEET]

[DIAGRAM]

### Core debt invariant 

For a given branch, the system maintains the following invariant:

**Aggregate total debt of a branch always equals the sum of individual entire Trove debts**.

That is:

`ActivePool.aggRecordedDebt + ActivePool.calcPendingAggInterest() = SUM_i=1_n(TroveManager.getEntireTroveDebt())`

For all `n` Troves in the branch.

It can be shown mathematically that this holds (TBD).

### Applying and minting pending aggregate interest (i.e. yield)


Pending aggregate interest is “applied” upon most system actions. That is:

- The  `aggRecordedDebt` is updated - the pending aggregate interest is calculated and added to `aggRecordedDebt`, and the `lastDebtUpdateTime` is updated to now.

- The pending aggregate interest is minted by the ActivePool as fresh BOLD. This is considered system “yield”.  A fixed part (75%) of it is immediately sent to the branch’s SP and split proportionally between depositors, and the remainder is sent to a router to be used as LP incentives on DEXes (determined by governance).

This is the only way BOLD is ever minted as interest. Applying individual interest to a Trove updates its recorded debt, but does not actually mint new BOLD tokens.

### Interest rate adjustments, redemption evasion mitigation 

A borrower may adjust their Trove’s interest rate at any time.

Since redemptions are performed in order of Troves’ user-set interest rates, a “premature adjustment fee” mechanism exists to prevent redemption evasion. Without it, low-interest rate borrowers could evade redemptions by sandwiching a redemption transaction with both an upward and downward interest rate adjustment, which in turn would unduly direct the redemption against higher-interest borrowers.

The premature adjustment fee works as so:

- When a Trove is opened, its `lastInterestRateAdjTime` property is set equal to the current time
- When a borrower adjusts their interest rate via `adjustTroveInterestRate` the system checks that the cooldown period has passed since their last interest rate adjustment 

- If the adjustment is sooner it incurs an upfront fee (equal to 7 days of average interest of the respective branch) which is added to their debt.

## BOLD Redemptions

Any BOLD holder (whether or not they have an active Trove) may redeem their BOLD directly with the system. Their BOLD is exchanged for a mixture of collaterals at face value: redeeming 1 BOLD token returns $1 worth of collaterals (minus a dynamic redemption fee), priced at their current market values according to their respective oracles. Redemptions have two purposes:


1. When BOLD is trading at <$1 on the external market, arbitrageurs may redeem `$x` worth of BOLD for `>$x` worth of collaterals, and instantly sell those collaterals to make a profit. This reduces the circulating supply of BOLD which in turn should help restore the $1 BOLD peg.


2. Redemptions improve the relative health of the least healthy collateral branches (those with greater "outside" debt, i.e. debt not covered by their SP).


## Redemption routing

[TODO - ROUTING DIAGRAM]

Redemptions are performed via the `CollateralRegistry.redeemCollateral` endpoint. A given redemption may be routed across several collateral branches.

A given BOLD redemption is split across branches according in proportion to the **outside debt** of that branch, i.e. (pseudocode):

`redeem_amount_i = redeem_amount * outside_debt_i / total_outside_debt`

Where `outside_debt_i` for branch i is given by `bold_debt_i  - bold_in_SP_i`.

That is, a redemption reduces the outside debt on each branch by the same percentage.

_Example: 2000 BOLD is redeemed across 4 branches_

[TABLE - BRANCH REDEMPTION]

<img width="704" alt="image" src="https://github.com/user-attachments/assets/21afcc49-ed50-4f3e-8b36-1949cd7a3809">

As can be seen in the above table and proven in generality (TBD), the outside debt is reduced by the same proportion in all branches, making redemptions path-independent.


[TODO - GRAPH BRANCH REDEMPTION]


## Redemptions at branch level

When BOLD is redeemed for collaterals, the system cancels the BOLD with debt from Troves, and the corresponding collateral is removed.

In order to fulfill the redemption request on a given branch, Troves are redeemed from in ascending order of their annual interest rates.

A redemption sequence of n steps will fully redeem all debt from the first n-1 Troves, and, and potentially partially redeem from the final Trove in the sequence.


Redemptions are skipped for Troves with ICR  < 100%. This is to ensure that redemptions improve the ICR of the Trove.

Unredeemable troves are also skipped (see unredeemable Troves section [LINK]).

### Redemption fees

The redemption fee mechanics are broadly the same as in Liquity v1,  but with adapted parametrization (TBD). The redemption fee is taken as a cut of the total ETH drawn from the system in a redemption. It is based on the current redemption rate.

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

- `baseRate` is decayed based on time passed since the last fee event and incremented by an amount proportional to the fraction of the total BOLD supply to be redeemed, i.e. `x/total_bold_supply`

The redemption fee percentage is given by `min(REDEMPTION_FEE_FLOOR + baseRate , 1)`.

### Redemption fee during bootstrapping period

At deployment, the `baseRate` is set to `INITIAL_REDEMPTION_RATE`, which is some sizable value e.g. 5%  - exact value TBD. It then decays as normal over time.

The intention is to discourage early redemptions in the early days when the total system debt is small, and give it time to grow.


## Unredeemable Troves

In Liquity v2, redemptions do not close Troves (unlike v1).

**Rationale for leaving Troves open**: Troves are now ordered by interest rate rather than ICR, and so (unlike v1) it is now possible to redeem Troves with ICR > TCR.  If such Troves were closed upon redemption, then redemptions may lower the TCR - this would be an economic risk / attack vector.

Hence redemptions in v2 always leave Troves open. This ensures that normal redemptions never lower the TCR* of a branch.

**Need for unredeemable Troves**: Leaving Troves open at redemption means redemptions may result in Troves with very small (or zero) `debt < MIN_DEBT`.  This could create a griefing risk - by creating many Troves with tiny `debt < MIN_DEBT` at the minimum interest rate, an attacker could “clog up” the bottom of the sorted list of Troves, and future redemptions would hit many Troves without redeeming much BOLD, or even be unprofitable due to gas costs.

Therefore, when a Trove is redeemed to below MIN_DEBT, it is tagged as unredeemable and removed from the sorted list.  

When a borrower touches their unredeemable Trove, they must either bring it back to `debt > MIN_DEBT` (in which case the Trove becomes redeemable again), or close it. Adjustments that leave it with insufficient debt are not possible.

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
- Can not have their interest rate changed by their owner/manager
- Can not be adjusted such that they're left with debt <`MIN_DEBT` by owner/manager
- Can be closed by their owner
- Can be brought above `MIN_DEBT` by owner (which re-adds them to the Sorted Troves list, and changes their status back to 'Active')

_(*as long as TCR > 100%. If TCR < 100%, then normal redemptions would lower the TCR, but the shutdown threshold is set above 100%, and therefore the branch would be shut down first. See the shutdown section [LINK].)_


## Stability Pool implementation

BOLD depositors in the Stability Pool on a given branch earn:

- BOLD yield paid from interest minted on Troves on that branch
- Collateral penalty gains from liquidated Troves on that branch


Depositors deposit BOLD to the SP via `provideToSP` and withdraw it with `withdrawFromSP`. 

Their accumulated collateral gains and BOLD yield gains are calculated every time they touch their deposit - i.e. at top up or withdrawal. If the depositor chooses to withdraw gains (via the `doClaim` bool param), all their collateral and BOLD yield gain are sent to their address.

Otherwise, their collateral gain is stashed in a tracked balance and their BOLD yield gain is added to their deposit.



### How deposits and ETH gains are calculated


The SP uses a scalable method of tracking deposits, collateral and yield gains which has O(1) complexity - i.e. constant gas cost regardless of the number of depositors. 

It is the same Product-Sum algorithm from Liquity v1.


### Collateral gains from Liquidations and the Product-Sum algorithm

When a liquidation occurs, rather than updating each depositor’s deposit and collateral and yield gain, we simply update two global tracker variables: a product `P`, a sum `S` corresponding to the collateral gain.

A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors’ compounded deposits and accumulated collateral gains over time, as liquidations occur, using just these two variables. When depositors join the Stability Pool, they get a snapshot of `P` and `S`.  

The approach is similar in spirit to the Scalable Reward Distribution on the Ethereum Network by Bogdan Batog et al (i.e. the standard UniPool algorithm), however, the arithmetic is more involved as it handles a compounding, decreasing stake along with a corresponding collateral gain.

The formula for a depositor’s accumulated collateral gain is derived here:

[LINK PAPER]

### Scalable reward distribution for compounding, decreasing stake

Each liquidation updates `P` and `S`. After a series of liquidations, a compounded deposit and corresponding ETH gain can be calculated using the initial deposit, the depositor’s snapshots, and the current values of `P` and `S`.

Any time a depositor updates their deposit (withdrawal, top-up) their collateral gain is paid out, and they receive new snapshots of `P` and `S`.

### BOLD Yield Gains

BOLD yield gains for Stability Pool depositors are triggered whenever the ActivePool mints aggregate system interest - that is, upon most system operations. The BOLD yield gain is minted to the Stability Pool and a BOLD gain for all depositors is triggered in proportion to their deposit size.

To efficiently and accurately track BOLD yield gains for depositors as deposits decrease over time from liquidations, we re-use the above product-sum algorithm for deposit and gains.


The same product `P` is used, and a sum `B` is used to track BOLD yield gains. Each deposit gets a new snapshot of `B` when it is updated.

### TODO -  mention P Issue fix

## Liquidation and the Stability Pool

When a Trove’s collateral ratio falls below the minimum collateral ratio (MCR) for its branch, it becomes immediately liquidatable.  Anyone may call `batchLiquidateTroves` with a custom list of Trove IDs to attempt to liquidate.

In a liquidation, most of the Trove’s collateral is seized and the Trove is closed.


Liquity utilizes a two-step liquidation mechanism in the following order of priority:

1. Offset under-collateralized Troves’ debt against the branch’s SP containing BOLD tokens, and award the seized collateral to the SP depositors
2. When the SP is empty, Redistribute under-collateralized Troves debt and seized collateral to other Troves in the same branch

Liquity primarily uses the BOLD tokens in its Stability Pool to absorb the under-collateralized debt, i.e. to repay the liquidated borrower's liability.

Any user may deposit BOLD tokens to any Stability Pool. This allows them to earn the collateral from Troves liquidated on the branch. When a liquidation occurs, the liquidated debt is cancelled with the same amount of BOLD in the Pool (which is burned as a result), and the seized collateral is proportionally distributed to depositors.

Stability Pool depositors can expect to earn net gains from liquidations, as in most cases, the value of the seized collateral will be greater than the value of the cancelled debt (since a liquidated Trove will likely have an ICR just slightly below the MCR). MCRs are constants and may differ between branches, but all take a value above 100%.

If the liquidated debt is higher than the amount of BOLD in the Stability Pool, the system applies both steps 1) and then 2): that is, it cancels as much debt as possible with the BOLD in the Stability Pool, and then redistributes the remaining liquidated collateral and debt across all active Troves in the branch.


## Liquidation logic

| Condition                         | Description                                                                                                                                                                                                                                                                                                                  |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ICR < MCR & SP.BOLD >= Trove.debt | BOLD in the StabilityPool equal to the Trove's debt is offset with the Trove's debt. The Trove's seized collateral is shared between depositors.                                                                                                                                                                                    |
| ICR < MCR & SP.BOLD < Trove.debt  | The total StabilityPool BOLD is offset with an equal amount of debt from the Trove. A portion of the Trove's collateral corresponding to the offset debt is shared between depositors. The remaining debt and seized collateral (minus collateral gas compensation) is redistributed to active Troves.  |
| ICR < MCR & SP.BOLD = 0           | Redistribute all debt and seized collateral (minus collateral gas compensation) to active Troves.                                                                                                                                                                                                                                    |
| ICR >= MCR                        | Liquidation not possible.                                                                                                                                                                                                                                                                                                     |


## Liquidation penalties and borrowers’ collateral surplus

Separate liquidation penalty percentages are used for offsets and redistributions - `LIQUIDATION_PENALTY_SP` and `LIQUIDATION_PENALTY_REDISTRIBUTION`. 

Exact values of these constants are TBD  for each branch, however the following inequalities will hold for every branch:

`LIQUIDATION_PENALTY_SP <= LIQUIDATION_PENALTY_REDISTRIBUTION <= 10% <= MCR`  

After liquidation, a liquidated borrower may have a collateral surplus to claim back (this is unlike Liquity v1 where the entire Trove collateral was always seized in Normal Mode).

In a pure offset, the maximum seized collateral is given by ` 1 + LIQUIDATION_PENALTY_SP`.  The claimable collateral surplus for the borrower is then the collateral remainder.

In a pure redistribution, the maximum seized collateral is given by `1 + LIQUIDATION_PENALTY_REDISTRIBUTION`. The claimable collateral surplus for the borrower is then the collateral remainder.

In a mixed offset and redistribution, the above logic is applied sequentially - that is:

- An intermediate collateral surplus is calculated for the offset portion of the Trove using the offset penalty
- The intermediate surplus is added to the collateral for the redistribution portion
- A final collateral surplus is calculated for the borrower using this total remaining collateral and the redistribution penalty

### Claiming collateral surpluses


Collateral surpluses for a given borrower accumulate in the CollSurplusPool, and are claimable by the borrower with `claimColl`.
                                                                                                                                                                       
## Liquidation gas compensation


The system compensates liquidators for their gas costs in order to incentivize rapid liquidations even in high gas price periods.

Gas compensation in Liquity v2 is entirely paid in a mixture of WETH and collateral from the Trove.

When a Trove is opened, a flat `ETH_GAS_COMPENSATION` of 0.0375 WETH is deposited by the borrower and set aside. This does not count as Trove’s collateral - i.e. it does not back any  debt and is not taken into account in the ICR or the TCR calculations.

If the borrower closes their Trove, this WETH is refunded.

The collateral portion of the gas compensation is calculated at liquidation. It is the lesser of: 0.5% of the Trove’s collateral, or 2 units of the LST.

That is, the max collateral that can be paid is 2 stETH on the stETH branch, 2 rETH on the rETH branch, etc.

Thus the total funds the liquidator receives upon a Trove liquidation is:

`0.0375 WETH + min(0.5% trove_collateral, 2_units_of_LST)`. 

## Critical collateral ratio (CCR) restrictions

When the TCR of a branch falls below its Critical Collateral Ratio (CCR), the system imposes extra restrictions on borrowing in order to maintain system health and branch overcollateralization.

Here is the full CCR-based logic:

<img width="703" alt="image" src="https://github.com/user-attachments/assets/63c1d142-ed93-47c6-a996-fe228c34476d">



As a result, when `TCR < CCR`, the following restrictions apply:

<img width="696" alt="image" src="https://github.com/user-attachments/assets/066d4bbe-58e5-4fca-8941-67341bf30e85">


### Rationale

The CCR logic has the following purposes:


- Ensure that when `TCR >= CCR` borrower operations can not reduce system health too much by bringing the `TCR < CCR`
- Ensure that when `TCR < CCR`, borrower operations only improve system health
- Ensure that when `TCR < CCR`, borrower operations can not grow the debt of the system

##  Delegation 

The system incorporates 3 types of delegation by which borrowers can outsource management of their Trove to third parties: 

- Add / Remove managers who can adjust an individual Trove’s collateral and debt
- Individual interest delegates who can adjust an individual Trove’s interest rate
- Batch interest delegates who can adjust the interest rate for a batch of several Troves

### Add and Remove managers

Add managers and Remove managers may be set by the Trove owner when the Trove is opened, or at any time later.

#### Add Managers

- An Add Manager may add collateral or repay debt to a Trove
- When set to `address(0)`, any address is allowed to perform these operations on the Trove
- Otherwise, only the designated `AddManager` in this mapping Trove is allowed to add collateral / repay debt
- A Trove owner may set the AddManager equal to their own address in order to disallow anyone from adding collateral / repaying debt.

#### Remove Managers

Remove Managers may withdraw collateral or draw new BOLD debt.

- Only the designated Remove manager, if any, and the Trove owner, are allowed 
- A receiver address may be chosen which can be different from the Remove Manager and Trove owner. The receiver receives the collateral and BOLD drawn by the Remove Manager.
- By default, a Trove has no Remove Manager - it must be explicitly set by the Trove owner upon opening or at a later point.
 - The receiver address can never be zero.

### Individual interest delegates

A Trove owner may set an individual delegate at any point after opening.The individual delegate has permission to update the Trove’s interest rate in a range set by the owner, i.e. `[ _minInterestRate,  _minInterestRate]`.  

A Trove can not be in a managed batch if it has an individual interest delegate. 

The Trove owner may also revoke individual delegate’s permission to change the given Trove’s interest rate at any point.

### Batch interest managers

A Trove owner may set a batch manager at any point after opening. They must choose a registered batch manager.

A batch manager controls the interest rate of Troves under their management, in a predefined range chosen when they register. This range may not be changed after registering, enabling borrowers to know in advance the min and max interest rates the manager could set.

All Troves in a given batch have the same interest rate, and all batch interest rate adjustments update the interest rate for all Troves in the batch.

Batch-management is gas-efficient and O(1) complexity - that is, altering the interest rate for a batch is constant gas cost regardless of the number of Troves. 

### Batch management implementation

In the `SortedTroves` list, batches of Troves are modeled as slices of the linked list. They utilise the new `Batch` data structure and `slice` functionality. A `Batch` contains head and tail properties, i.e. the ends of the list slice.

When a batch manager updates their batch’s interest rate, the entire `Batch` is reinserted to its new position based on the interest rate ordering of the SortedTroves list. 

 ### Internal representation as shared Trove

A batch accrues three kinds of time-based debt increases: normal interest, management fees and possibly redistribution gains over time. 

To handle all these in a gas-efficient way, the batch is internally modelled as a single “shared” Trove. 

The system tracks a batch’s `recordedDebt` and `annualInterestRate`. Accrued interest is calculated in the same way as for individual Troves, and the batch’s weighted debt is incorporated in the aggregate sum as usual.

Similarly, redistributions are paid proportionally to the total collateral of the batch.

### Batch management fee

The management fee is an annual percentage, and is calculated in the same way as annual interest. 

### Batch `recordedDebt` updates

A batch’s `recordedDebt` is updated when:
- a Trove in a batch has it’s debt updated by the borrower
- The batch manager changes the batch’s interest rate

The accrued interest and accrued management fees are calculated and added to the debt

### Batch premature adjustment fees

Batch managers incur premature fees in the same manner as individual Troves - i.e. if they adjust before the cooldown period has past since their last adjustment [LINK - premature adjustment fee].

When a borrower adds their Trove to a batch, there is a trust assumption: they expect the batch manager to manage interest rates well and not incur excessive adjustment fees.  However, the manager can commit in advance to a maximum update frequency when they register by passing a `_minInterestRateChangePeriod`.

Generally is expected that competent batch managers will build good reputations and attract borrowers. Malicious or poor managers will likely end up with empty batches in the long-term.


## Collateral branch shutdown

Under extreme conditions such as collateral price collapse or oracle failure, a collateral branch may be shut down in order to preserve wider system health and the stability of the BOLD token.

A collateral branch is shut down when:

1. Its TCR falls below the Shutdown Collateral Ratio (SCR)
2. One of the branch’s external price oracles fails during a `fetchPrice` call. That is: either the call to the oracle reverts, or returns 0, or returns a price that is too stale.

When `TCR < SCR` (1), anyone may trigger branch shutdown by calling `BorrowerOperations.shutdown`.

Oracle failure (2) may occur during any operation which requires collateral pricing and calls `fetchPrice`, i.e. borrower operations, redemptions or liquidations, as well as a pure fetchPrice call (since this function is permissionless). Any of these operations may trigger branch shutdown when an oracle has failed.

### Interest rates and shutdown

Upon shutdown:
- All pending aggregate interest gets applied and minted
- All pending aggregate batch management fees get applied and minted

And thereafter:
- No further aggregate interest is minted or accrued
- Individual Troves accrue no further interest. Trove accrued interest is calculated only up to the shutdown timestamp
- Batches accrue no further interest nor management fees. Accrued interest and fees are only calculated up to the shutdown timestamp

Once a branch has been shut down it can not be revived.

###  Shutdown logic

The following operations are disallowed at shutdown:

- Opening a new Trove
- Adjusting a Trove’s debt or collateral
- Adjusting a Trove’s interest rate
- Applying a Trove’s interest
- Adjusting a batch’s interest rate
- Applying a batch’s interest and management fee
- Normal redemptions

The following operations are still allowed after shut down:

- Closing a Trove
- Liquidating Troves
- Depositing to and withdrawing from the SP
- Urgent redemptions (see below)

 ### Urgent redemptions 

During shutdown the redemption logic is modified to incentivize swift reduction of the branch’s debt, and even do so when BOLD is trading at peg ($1 USD). Redemptions in shutdown are known as “urgent” redemptions.

Urgent redemptions:

- Are performed directly via the shut down branch’s `TroveManager`, and they only affect that branch. They are not routed across branches.
- Charge no redemption fee
- Pay a slight collateral bonus of 1% to the redeemer. That is, in exchange for every 1 BOLD redeemed, the redeemer receives $1.01 worth of the LST collateral.
- Do not redeem Troves in order of interest rate. Instead, the redeemer passes a list of Troves to redeem from.
- Do not create unredeemable Troves, even if the Trove is left with tiny or zero debt - since, due to the preceding point there is no risk of clogging up future urgent redemptions with tiny Troves.

## Known issues and mitigations

### Oracle price frontrunning

Push oracles are used for all collateral pricing. Since these oracles push price update transactions on-chain, it is possible to frontrun them with redemption transactions.

An attack sequence may look like this:

- Observe collateral price increase oracle update in the mempool
- Frontrun with redemption transaction for `$x`, and receive `$x - fee` worth of collateral
- Oracle price increase update transaction is validated
- Sell redeemed collateral for `$y` such that `$y > $x`, due to the price increase
- Extracts `$(y-x)` from the system.

This is “hard” frontrunning: the attacker directly frontrun the oracle price update. “Soft” frontrunning is also possible when the attacker sees the market price increase before even seeing the oracle price update transaction in the mempool.

The value extracted is excessive, i.e. above and beyond the arbitrage profit expected from BOLD peg restoration. In fact, oracle frontrunning can be performed when BOLD is trading >= $1.

In Liquity v1, this issue was largely mitigated by the 0.5% minimum redemption fee which matched Chainlink’s ETH-USD oracle update threshold of 0.5%.

In v2, some oracles used for LSTs have larger update thresholds - e.g. Chainlink’s RETH-ETH, at 2%.

However, we don’t expect oracle frontrunning to be a significant issue since these LST-ETH feeds are historically not volatile and rarely deviate by significant amounts: they usually update based on the heartbeat (mininum update frequency) rather than the threshold.

 Still several solutions were considered. None are ideal:

| Solution                                                                                  | Challenge                                                                                                                                                   |
|-------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Low latency pull-based oracle                                                             | Mainnet block-time introduces a lower bound for price staleness. According to Chainlink, during high vol periods, these oracles may not be fast enough on mainnet |
| Custom 2-step redemptions: commit-confirm pattern, redeemer confirms                      | Price uncertainty for legitimate redemption arbers. Could discourage legitimate redemptions                                                                 |
| 2-step redemptions with pull-based oracle. Commit-confirm pattern, keeper confirms        | Price uncertainty for legitimate redemption arbers. Could discourage legitimate redemptions                                                                 |
| Canonical rate oracle (ETH-USD_market x LST_ETH_canonical) for redemptions                | Likely fixes the issue - though in case of canonical rate manipulation, redemptions would be unprofitable (upward manipulation) or pay too much collateral (downward manipulation) |
| Canonical rate oracle (ETH-USD_market x LST_ETH_canonical) for redemptions, with upward and downward protection (e.g. Aave) | Likely fixes the issue - but cap parameters may be hard to tune, and could not be changed                                                                  |
| Adapt redemption fee parameters (fee spike gain, fee decay half-life)                     | Hard to tune parameters                                                                                                                                     |

#### Solution 

Solution 6 was provisionally chosen, as it involves minimal technical complexity. Parameters for redemptions are TBD.

### Bypassing redemption routing logic via temporary SP deposits

The redemption routing logic reduces the “outside” debt of each branch by the same percentage, where outside debt for branch `i` is given by:

`outside_debt_i = bold_debt_i  - bold_in_SP_i`.

It is clearly possible for a redeemer to temporarily manipulate the outside debt of one or more branches by depositing to the SP.

Thus, an attacker could direct redemptions to their chosen branch(es) by depositing to SPs in branches they don’t wish to redeem from.  For example:

This sequence - deposit to SPs on unwanted branches, then redeem from chosen branch(es) -  could be done in one transaction and a flash loan could be used to obtain the BOLD funds for deposits.

By doing this redeemer extracts no extra value from the system, though it may increase their profit if they are able to choose LSTs to redeem which have lower slippage on external markets.
The manipulation does not change the fee the attacker pays (which is based on the total BOLD supply).

#### Solution

Currently no fix is in place, because:

- The redemption arbitrage is highly competitive, and flash loan fees reduce profits (though, the manipulation could still result in a greater profit as mentioned above)
- There is no direct value extraction from the system
- Redemption routing is not critical to system health. It is intended as a soft measure to nudge the system back to a healthier state, but in the end the system is heavily reliant on the health of all collateral markets/assets.

### Path-dependent redemptions: lower fee when chunking

The redemption fee formula is not path-dependent: that is, given some given prior system state, the fee incurred from redeeming one big chunk of BOLD in a single transaction is greater than the total fee incurred by redeeming the same BOLD amount in many smaller chunks over many transactions (assuming no other system state change in between chunks).

As such, redeemers may be incentivised to split their redemption into many transactions in order to pay a lower total redemption fee.

See this example from this sheet [LINK]:
https://docs.google.com/spreadsheets/d/1MPVI6edLLbGnqsEo-abijaaLnXle-cJA_vE4CN16kOE/edit?usp=sharing



#### Solution

No fix is deemed necessary, since:

- Redemption arbitrage is competitive and profit margins are thin. Chunking redemptions incurs higher gas costs and eats into arb profits.
 Redemptions in Liquity v1 (with the same fee formula) have broadly functioned well, and proven effective in restoring the LUSD peg.
- The redemption fee gain and the redemption half-life are “best-guess” parameters anyway - there’s little reason to believe that even the intended fee scheme is absolutely optimal

### Oracle failure and urgent redemptions with the frozen last good price

When an oracle failure triggers a branch shutdown, the respective PriceFeed’s `fetchPrice` function returns the recorded `lastGoodPrice` price thereafter. Thus LST on that branch is then always using `lastGoodPrice`.

During shutdown, the only operation that uses the LST price is urgent redemptions.   

When `lastGoodPrice` is used, the real market price may be higher or lower. This leads the following distortions:

| Scenario                     | Consequence                                                                                                                                       |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| lastGoodPrice > market price | Urgent redemptions return too little LST collateral, and may be unprofitable even when BOLD trades at $1 or below                                   |
| lastGoodPrice < market price | Urgent redemptions return too much LST collateral. They may be too profitable, and not clear enough debt for the collateral redeemed                |


#### Solution

No fix is implemented for this, for the following reasons:

- In both cases, the final result is that some uncleared BOLD debt remains on the shut down branch, and the system carries this unbacked debt burden going forward.  This is an inherent risk of a multicollateral system anyway, which relies on the economic health of the LST assets it integrates.
- Clearing as much debt from a shut down branch as possible is considered desirable, but the system is designed to be able to absorb some bad debt due to overall overcollateralization
- Oracle failure, if it occurs, will much more likely be due to a disabled Chainlink feed rather than hack or technical failure. A disabled LST oracle implies an LST with low liquidity/volume, which in turn probably implies the LST constitutes a small fraction of total Liquity v2 collateral. In this case, the bad debt should likely be small relative to total system debt, and the overall overcollateralization should maintain the BOLD peg.

## TODO - Oracles
### Oracle architecture and rationale
### Oracle logic
### Mitigations

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
