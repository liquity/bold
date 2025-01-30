![Liquity V2](https://github.com/user-attachments/assets/b3ffbc5e-b7a8-46b6-a080-e18a0792bb64)

[![Coverage Status](https://coveralls.io/repos/github/liquity/bold/badge.svg?branch=main&t=yZSfc8)](https://coveralls.io/github/liquity/bold?branch=main)

## Table of Contents
1. [Significant Changes in Liquity v2](#significant-changes-in-liquity-v2)

2. [What Remains the Same in v2 from v1](#what-remains-the-same-in-v2-from-v1)
  
3. [Liquity v2 Overview](#liquity-v2-overview)

4. [Multicollateral Architecture Overview](#multicollateral-architecture-overview)

5. [Core System Contracts](#core-system-contracts)
   - [Top Level Contracts](#top-level-contracts)
   - [Branch-level Contracts](#branch-level-contracts)
   - [Peripheral Helper Contracts](#peripheral-helper-contracts)

6. [Mainnet PriceFeed Contracts](#mainnet-pricefeed-contracts)

7. [Public State-changing Functions](#public-state-changing-functions)
   - [CollateralRegistry](#collateralregistry)
   - [BorrowerOperations](#borroweroperations)
   - [TroveManager](#trovemanager)
   - [StabilityPool](#stabilitypool)
   - [All PriceFeeds](#all-pricefeeds)
   - [BOLDToken](#boldtoken)

8. [Borrowing, Fees, and Interest Rates](#borrowing-fees-and-interest-rates)
   - [Interest on Trove Debt](#interest-on-trove-debt)
   - [Applying a Trove’s Interest](#applying-a-troves-interest)
   - [Interest Rate Scheme Implementation](#interest-rate-scheme-implementation)
   - [Core Debt Invariant](#core-debt-invariant)
   - [Redemption Evasion Mitigation](#redemption-evasion-mitigation)
   - [Upfront Borrowing Fees](#upfront-borrowing-fees)
   - [Premature Adjustment Fees](#premature-adjustment-fees)
   - [Batches and Premature Adjustment Fees](#batches-and-premature-adjustment-fees)

9. [Supplying Hints to Trove Operations](#supplying-hints-to-trove-operations)

10. [Example OpenTrove Transaction with Hints](#example-opentrove-transaction-with-hints)

11. [BOLD Redemptions](#bold-redemptions)

12. [Redemption Routing](#redemption-routing)

13. [Redemptions at Branch Level](#redemptions-at-branch-level)
   - [Redemption Fees](#redemption-fees)
   - [Fee Schedule](#fee-schedule)
   - [Redemption Fee During Bootstrapping Period](#redemption-fee-during-bootstrapping-period)

14. [Unredeemable Troves](#unredeemable-troves)

15. [Stability Pool Implementation](#stability-pool-implementation)
   - [How Deposits and ETH Gains are Calculated](#how-deposits-and-eth-gains-are-calculated)
   - [Collateral Gains from Liquidations and the Product-Sum Algorithm](#collateral-gains-from-liquidations-and-the-product-sum-algorithm)
   - [BOLD Yield Gains](#bold-yield-gains)

16. [Liquidation and the Stability Pool](#liquidation-and-the-stability-pool)

17. [Liquidation Logic](#liquidation-logic)

18. [Liquidation Penalties and Borrowers’ Collateral Surplus](#liquidation-penalties-and-borrowers-collateral-surplus)
   - [Claiming Collateral Surpluses](#claiming-collateral-surpluses)

19. [Liquidation Gas Compensation](#liquidation-gas-compensation)

20. [Redistributions](#redistributions)
   - [Corrected Stake Solution](#corrected-stake-solution)

21. [Critical Collateral Ratio (CCR) Restrictions](#critical-collateral-ratio-ccr-restrictions)

22. [Delegation](#delegation)
   - [Add and Remove Managers](#add-and-remove-managers)
   - [Individual Interest Delegates](#individual-interest-delegates)
   - [Batch Interest Managers](#batch-interest-managers)
   - [Batch Management Implementation](#batch-management-implementation)

23. [Collateral Branch Shutdown](#collateral-branch-shutdown)
   - [Shutdown Logic](#shutdown-logic)
   - [Urgent Redemptions](#urgent-redemptions)

24. [Collateral Choices in Liquity v2](#collateral-choices-in-liquity-v2)

25. [Oracles in Liquity v2](#oracles-in-liquity-v2)
   - [Terminology](#terminology)
   - [Choice of Oracles and Price Calculations](#choice-of-oracles-and-price-calculations)
   - [PriceFeed Deployment](#pricefeed-deployment)
   - [Fetching the Price](#fetching-the-price)

26. [Known Issues and Mitigations](#known-issues-and-mitigations)
   - [1 - Oracle Price Frontrunning](#1---oracle-price-frontrunning)
   - [2 - Bypassing Redemption Routing Logic via Temporary SP Deposits](#2---bypassing-redemption-routing-logic-via-temporary-sp-deposits)
   - [3 - Path-dependent Redemptions: Lower Fee when Chunking](#3---path-dependent-redemptions-lower-fee-when-chunking)
   - [4 - Oracle Failure and Urgent Redemptions with the Frozen Last Good Price](#4---oracle-failure-and-urgent-redemptions-with-the-frozen-last-good-price)
   - [5 - Stale Oracle Price Before Shutdown Triggered](#5---stale-oracle-price-before-shutdown-triggered)
   - [6 - Batch Management Ops Don’t Check for a Shutdown Branch](#6---batch-management-ops-dont-check-for-a-shutdown-branch)
   - [7 - Discrepancy Between Aggregate and Sum of Individual Debts](#7---discrepancy-between-aggregate-and-sum-of-individual-debts)
   - [8 - Discrepancy Between `yieldGainsOwed` and Sum of Individual Yield Gains in StabilityPool](#8---discrepancy-between-yieldgainsowed-and-sum-of-individual-yield-gains-in-stabilitypool)
   - [9 - LST Oracle Risks](#9---lst-oracle-risks)
   - [10 - Branch Shutdown and Bad Debt](#10---branch-shutdown-and-bad-debt)
   - [11 - Inaccurate Calculation of Average Branch Interest Rate](#11---inaccurate-calculation-of-average-branch-interest-rate)
   - [12 - TroveManager Can Make Troves Liquidatable by Changing the Batch Interest Rate](#12---trovemanager-can-make-troves-liquidatable-by-changing-the-batch-interest-rate)
   - [13 - Trove Adjustments May Be Griefed by Sandwich Raising the Average Interest Rate](#13---trove-adjustments-may-be-griefed-by-sandwich-raising-the-average-interest-rate)
   - [14 - Stability Pool Claiming and Compounding Yield Can Be Used to Gain a Slightly Higher Rate of Rewards](#14---stability-pool-claiming-and-compounding-yield-can-be-used-to-gain-a-slightly-higher-rate-of-rewards)
   - [15 - Urgent Redemptions Premium Can Worsen the ICR](#15---urgent-redemptions-premium-can-worsen-the-icr)
   - [16 - Oracle code nitpicks](#16---oracle-code-nitpicks)
   - [17 - Path dependence of redistributions](#17---path-dependence-of-redistributions---sequential-vs-batch-liquidations)
   - [18 - TODOs left in code comments](#18---todos-in-code-comments)

   - [Issues identified in audits requiring no fix](#issues-identified-in-audits-requiring-no-fix)
     

27. [Requirements](#requirements)

28. [Setup](#setup)

29. [How to Develop](#how-to-develop)





## Significant changes in Liquity v2

- **Multi-collateral system.** The system now consists of a CollateralRegistry and multiple collateral branches. Each collateral branch is parameterized separately with its own Minimum Collateral Ratio (MCR), Critical Collateral Ratio (CCR) and Shutdown Collateral Ratio (SCR). Each collateral branch contains its own TroveManager and StabilityPool. Troves in a given branch only accept a single collateral (never mixed collateral). Liquidations of Troves in a given branch via SP offset are offset purely against the SP for that branch, and liquidation gains for SP depositors are always paid in a single collateral. Similarly, liquidations via redistribution split the collateral and debt across purely active Troves in that branch.
 
- **Collateral choices.** The system will contain collateral branches for WETH and two LSTs: rETH and wstETH. It does not accept native ETH as collateral.

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

- **Liquidation penalties**. Liquidated borrowers now no longer always lose their entire collateral in a liquidation. Depending on the collateral branch and liquidation type, they may be able to reclaim a small remainder.

- **Gas compensation**. Liquidations now pay gas compensation to the liquidator in a mix of collateral and WETH. The liquidation reserve is denominated in WETH irrespective of the collateral plus a variable compensation in the collateral, which is capped to avoid excessive compensations. 

- **More flexibility for SP reward claiming**.. SP depositors can now claim or stash their LST gains from liquidations, and either claim their BOLD yield gains or add them to their deposit.

### What remains the same in v2 from v1?

- **Core redemption mechanism** - swaps 1 BOLD for $1 worth of collateral, less the fee, in order to maintain a hard BOLD price floor


- **Redemption fee mechanics at branch level**. The `baseRate` with fee spike based on redemption volume, and time-based decay.

- **Ordered Troves**. Each branch maintains a sorted list of Troves (though now ordered by annual interest rate).

- **Liquidation mechanisms**. Liquidated Troves are still offset against the BOLD in the SP and redistribution to active Troves in the branch if/when the SP deposits are insufficient (though the liquidation penalty applied to the borrower is reduced).

- **Similar smart contract architecture**. At branch level the system architecture closely resembles that of v1 - the `TroveManager`, `BorrowerOperations` and `StabilityPool` contracts contain most system logic and direct the flows of BOLD and collateral.

- **Stability Pool algorithm**. Same arithmetic and logic is used for tracking deposits, collateral gains and BOLD yield gains over time as liquidations deplete the pool.

- **Individual overcollateralization**. Each Trove is individually overcollateralized and liquidated below the branch-specific MCR.

- **Aggregate (branch level) overcollateralization.** Each branch is overcollateralized, measured by the respective TCR.


## Liquity v2 Overview

Liquity v2 is a collateralized debt platform. Users can lock up WETH and/or select LSTs, and issue stablecoin tokens (BOLD) to their own Ethereum address. The individual collateralized debt positions are called Troves.


The stablecoin tokens are economically geared towards maintaining value of 1 BOLD = $1 USD, due to the following properties:


1. The system is designed to always be over-collateralized - the dollar value of the locked collateral exceeds the dollar value of the issued stablecoins.


2. The stablecoins are fully redeemable - users can always swap x BOLD for $x worth of a mix of WETH and LSTs (minus fees), directly with the system.
   
3. The system incorporates an adaptive interest rate mechanism, managing the attractiveness and thus the demand for holding and borrowing the stablecoin in a market-driven way.  


Upon  opening a Trove by depositing a viable collateral ERC20, users may issue ("borrow") BOLD tokens such that the collateralization ratio of their Trove remains above the minimum collateral ratio (MCR) for their collateral branch. For example, for an MCR of 110%, a user with $10000 worth of WETH in a Trove can issue up to 9090.90 BOLD against it.


The BOLD tokens are freely exchangeable - any Ethereum address can send or receive BOLD tokens, whether it has an open Trove or not. The BOLD tokens are burned upon repayment of a Trove's debt.


The Liquity v2 system prices collateral via Chainlink oracles. When a Trove falls below the MCR, it is considered under-collateralized, and is vulnerable to liquidation.


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

- `TroveNFT` - Implements basic mint and burn functionality for Trove NFTs, controlled by the `TroveManager`. Implements the tokenURI functionality which serves Trove metadata, i.e. a unique image for each Trove.

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

Different PriceFeed contracts are needed for pricing collaterals on different branches, since the price calculation methods differ across LSTs see the [Oracle section](#oracles-in-liquity-v2). However, much of the functionality is common to a couple of parent contracts.

- `MainnetPriceFeedBase` - Base contract that contains functionality for fetching prices from external Chainlink (and possibly Redstone) push oracles, verifying the responses, and triggering collateral branch shutdown in case of an oracle failure.


- `CompositePriceFeed` - Base contract that inherits `MainnetPriceFeedBase` and contains functionality for fetching prices from two market oracles: LST-ETH and ETH-USD, and calculating a composite LST- USD `market_price`. It also fetches the LST contract’s LST-ETH exchange rate, calculates a composite LST-USD `exchange_rate_price` and the final LST-USD price returned is `min(market_price, exchange_rate_price)`.

- `WETHPriceFeed` Inherits `MainnetPriceFeedBase`. Fetches the ETH-USD price from a Chainlink push oracle. Used to price collateral on the WETH branch.

- `WSTETHPriceFeed` - Inherits `MainnetPriceFeedBase`. Fetches the STETH-USD price from a Chainlink push oracle, and computes WSTETH-USD price from the STETH-USD price the WSTETH-STETH exchange rate from the LST contract. Used to price collateral on a WSTETH branch.

- `RETHPriceFeed` - Inherits `CompositePriceFeed` and fetches the specific RETH-ETH exchange rate from RocketPool’s RETHToken. Used to price collateral on a RETH branch.

## Public state-changing functions

### CollateralRegistry


- `redeemCollateral(uint256 _boldAmount, uint256 _maxIterations, uint256 _maxFeePercentage)`: redeems `_boldAmount` of BOLD tokens from the system in exchange for a mix of collaterals. Splits the BOLD redemption according to the [redemption routing logic](#redemption-routing), redeems from a number of Troves in each collateral branch, burns `_boldAmount` from the caller’s BOLD balance, and transfers each redeemed collateral amount to the redeemer. Executes successfully if the caller has sufficient BOLD to redeem. The number of Troves redeemed from per branch is capped by `_maxIterationsPerCollateral`. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept which mitigates fee slippage, i.e. when another redemption transaction is processed first and drives up the redemption fee.  Troves left with `debt < MIN_DEBT` are flagged as `unredeemable`.

### BorrowerOperations

- `openTrove(
        address _owner,
        uint256 _ownerIndex,
        uint256 _collAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee,
        address _addManager,
        address _removeManager,
        address _receiver
    )`: creates a Trove for the caller that is not part of a batch. Transfers `_collAmount` from the caller to the system, mints `_boldAmount` of BOLD to their address. Mints the Trove NFT to their address. The `ETH_GAS_COMPENSATION` of 0.0375 WETH is transferred from the caller to the GasPool. Opening a Trove must result in the Trove’s ICR > MCR, and also the system’s TCR > CCR. An `upfrontFee` is charged, based on the system’s _average_ interest rate, the BOLD debt drawn and the `UPFRONT_INTEREST_PERIOD`. The borrower chooses a `_maxUpfrontFee` that he/she is willing to accept in case of a fee slippage, i.e. when the system’s average interest rate increases and in turn increases the fee they’d pay. The optional `_addManager` permits that address to improve the collateral ratio of the Trove - i.e. to add collateral or to repay debt. The optional `_removeManager` is permitted to reduce the collateral ratio of the Trove, that is to remove collateral or draw new debt, and also to close it. The `_receiver` is the address the `_removeManager` can send funds to.


- `openTroveAndJoinInterestBatchManager(OpenTroveAndJoinInterestBatchManagerParams calldata _params )`: creates a Trove for the caller and adds it to the chosen `_interestBatchManager`’s batch. Transfers `_collAmount` from the caller to the system and mints `_boldAmount` of BOLD to their address.  Mints the Trove NFT to their address. The `ETH_GAS_COMPENSATION` of 0.0375 WETH is transferred from the caller to the GasPool. Opening a batch Trove must result in the Trove’s ICR >= MCR, and also the system’s TCR >= CCR. An `upfrontFee` is charged, based on the system’s _average_ interest rate, the BOLD debt drawn and the `UPFRONT_INTEREST_PERIOD`. The fee is added to the Trove’s debt. The borrower chooses a `_maxUpfrontFee` that he/she is willing to accept in case of a fee slippage, i.e. when the system’s average interest rate increases and in turn increases the fee they’d pay.

The function takes the following param struct as input:
- `struct OpenTroveAndJoinInterestBatchManagerParams {
        address owner;
        uint256 ownerIndex;
        uint256 collAmount;
        uint256 boldAmount;
        uint256 upperHint;
        uint256 lowerHint;
        address interestBatchManager;
        uint256 maxUpfrontFee;
        address addManager;
        address removeManager;
        address receiver;
    }`

- `addColl(uint256 _troveId, uint256 _collAmount)`: Transfers the `_collAmount` from the user to the system, and adds the received collateral to the caller's active Trove.

- `withdrawColl(uint256 _troveId, uint256 _amount)`: withdraws _amount of collateral from the caller’s Trove. Executes only if the user has an active Trove, must result in the user’s Trove `ICR >= MCR` and must obey the adjustment [CCR constraints](#critical-collateral-ratio-ccr-restrictions).

 - `withdrawBold(uint256 _troveId, uint256 _amount, uint256 _maxUpfrontFee)`: adds _amount of BOLD to the user’s Trove’s debt, mints BOLD stablecoins to the user. Must result in `ICR >= MCR` and must obey the adjustment [CCR constraints](#critical-collateral-ratio-ccr-restrictions). An `upfrontFee` is charged, based on the system’s _average_ interest rate, the BOLD debt drawn and the `UPFRONT_INTEREST_PERIOD`. The fee is added to the Trove’s debt. The borrower chooses a `_maxUpfrontFee` that he/she is willing to accept in case of a fee slippage, i.e. when the system’s average interest rate increases and in turn increases the fee they’d pay.	

 - `repayBold(uint256 _troveId, uint256 _amount)`: repay `_amount` of BOLD to the caller’s Trove, canceling that amount of debt. Transfers the BOLD from the caller to the system.

 - `closeTrove(uint256 _troveId)`: repays all debt in the user’s Trove, withdraws all their collateral to their address, and closes their Trove. Requires the borrower have a BOLD balance sufficient to repay their Trove's debt. Burns the BOLD from the user’s address.

- `adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _maxUpfrontFee
    )`:  enables a borrower to simultaneously change both their collateral and debt, subject to the resulting `ICR >= MCR` and the adjustment [CCR constraints](#critical-collateral-ratio-ccr-restrictions). If the adjustment incorporates a `debtIncrease`, then an `upfrontFee` is charged as per `withdrawBold`.


- `adjustZombieTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )` - enables a borrower with a unredeemable Trove to adjust it. Any adjustment must result in the Trove’s `debt > MIN_DEBT` and `ICR > MCR`, along with the usual borrowing [CCR constraints](#critical-collateral-ratio-ccr-restrictions). The adjustment reinserts it to its previous batch, if it had one.

- `claimCollateral()`: Claims the caller’s accumulated collateral surplus gains from their liquidated Troves which were left with a collateral surplus after collateral seizure at liquidation.  Sends the accumulated collateral surplus to the caller and zeros their recorded balance.

- `shutdown()`: Shuts down the entire collateral branch. Only executes if the TCR < SCR, and it is not already shut down. Mints the final chunk of aggregate interest for the branch, and flags it as shut down.

- `adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    )`: Change’s the caller’s annual interest rate on their Trove. The update is considered “premature” if they’ve recently changed their interest rate (i.e. within `INTEREST_RATE_ADJ_COOLDOWN` seconds), and if so, they incur an upfront fee - see the [interest rate adjustment section](#interest-rate-adjustments-redemption-evasion-mitigation).  The fee is also based on the system average interest rate, so the user may provide a `_maxUpfrontFee` if they make a premature adjustment.

- `applyPendingDebt(uint256 _troveId, uint256 _lowerHint, uint256 _upperHint)`: Applies all pending debt to the Trove - i.e. adds its accrued interest and any redistribution debt gain, to its recorded debt and updates its `lastDebtUpdateTime` to now. The purpose is to make sure all Troves can have their interest and gains applied with sufficient regularity even if their owner doesn’t touch them. Also makes unredeemable Troves that have reached `debt > MIN_DEBT` (e.g. from interest or redistribution gains) become redeemable again, by reinserting them to the SortedList and previous batch (if they were in one).  If the Trove is in a batch, it applies all of the batch's accrued interest and accrued management fee to the batch's recorded debt, as well as the _individual_ Trove's redistribution debt gain.

-  `setAddManager(uint256 _troveId, address _manager)`: sets an “Add” manager for the caller’s chosen Trove, who has permission to add collateral and repay debt to their Trove.

-  `setRemoveManager(uint256 _troveId, address _manager)`: sets a “Remove” manager for the caller’s chosen Trove, who has permission to remove collateral from and draw new BOLD from their Trove.

- `setRemoveManagerWithReceiver(uint256 _troveId, address _manager, address _receiver)`: sets a “Remove” manager for the caller’s chosen Trove, who has permission to remove collateral from and draw new BOLD from their Trove to the provided `_receiver` address.

- `setInterestIndividualDelegate(
        uint256 _troveId,
        address _delegate,
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee,
        uint256 _minInterestRateChangePeriod
    )`: the Trove owner sets an individual delegate who will have permission to update the interest rate for that Trove in range `[ _minInterestRate,  _maxInterestRate]`.  Removes the Trove from a batch if it was in one. The `_minInterestRateChangePeriod` determines the minimum period that must pass between the delegates's interest rate adjustments.

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

### TroveManager

- `batchLiquidateTroves(uint256[] calldata _troveArray)`: Accepts a custom list of Troves IDs as an argument. Steps through the provided list and attempts to liquidate every Trove, until it reaches the end or it runs out of gas. A Trove is liquidated only if it meets the conditions for liquidation, i.e. ICR < MCR. Troves with ICR >= MCR are skipped in the loop. Permissionless.


- `urgentRedemption(uint256 _boldAmount, uint256[] calldata _troveIds, uint256 _minCollateral)`: Executes successfully only when the collateral branch has already been shut down.  Redeems only from the branch it is called on. Redeems from Troves with a slight collateral bonus - that is, 1 BOLD redeems for $1.01 worth of LST collateral.  Does not flag any redeemed-from Troves as `unredeemable`. Caller specifies the `_minCollateral` they want to receive.

### StabilityPool

- `provideToSP(uint256 _amount, bool _doClaim)`: deposit _amount of BOLD to the Stability Pool. It transfers _amount of BOLD from the caller’s address to the Pool, and tops up their BOLD deposit by _amount. `doClaim` determines how the depositor’s existing collateral and BOLD yield gains (if any exist) are treated: if true they’re transferred to the depositor’s address, otherwise the collateral is stashed (added to a balance tracker) and the BOLD gain is added to their deposit.

- `withdrawFromSP(uint256 _amount, bool doClaim)`: withdraws _amount of BOLD from the Stability Pool, up to the value of their remaining deposit. It increases their BOLD balance by _amount. If the user makes a partial withdrawal, their remaining deposit will earn further liquidation and yield gains.  `doClaim` determines how the depositor’s existing collateral and BOLD yield gains (if any exist) are treated: if true they’re transferred to the depositor’s address, otherwise the collateral is stashed (added to a balance tracker) and the BOLD gain is added to their deposit.


- `claimAllCollGains()`: Sends all stashed collateral gains to the caller and zeros their stashed balance. Used only when the caller has no current deposit yet has stashed collateral gains from the past.

### All PriceFeeds

`fetchPrice()`:  Permissionless. Tells the PriceFeed to fetch price answers from oracles, and if necessary calculates the final derived LST-USD price. Checks if any oracle used has failed (i.e. if it reverted, returned a stale price, or a 0 price). If so, shuts the collateral branch down. Otherwise, stores the fetched price as `lastGoodPrice`. 

### BOLDToken

Standard ERC20 and EIP2612 (`permit()` ) functionality.



## Borrowing, fees and interest rates

When a Trove is opened, borrowers commit an amount of their chosen LST token as collateral, select their BOLD debt, and select an interest rate in range `[INTEREST_RATE_MIN, INTEREST_RATE_MAX]`.

### Interest on Trove debt

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

The theoretical approach is laid out in [this paper](https://docs.google.com/document/d/1KOP09exxLcrNKHoJ9zgxvNFS_W9AIy5jt85OqmeAwN4/edit?usp=sharing).

In practice, the implementation in code follows these steps but the exact sequence of operations is sometimes different due to other considerations (e.g. gas efficiency).

### Aggregate vs individual recorded debts

Importantly, the `aggRecordedDebt` does *not* always equal the sum of individual recorded Trove debts.

This is because the `aggRecordedDebt` is updated very regularly, whereas a given Trove’s recorded debt may not be.  When the `aggRecordedDebt` has been updated more recently than a given Trove, then it already includes that Trove’s accrued interest - because when it is updated, _all_ Trove's accrued pending interest is added to it.

It’s best to think of the `aggRecordedDebt` and aggregate interest calculation running in parallel to the individual recorded debts and interest.

[This example](https://docs.google.com/spreadsheets/d/1Q_PtY4iyUsTNVQi-a90fS0B4ODEQpJE-GwpiIUDRoas/edit?usp=sharing) illustrates how it works.

[TODO - DIAGRAM]

### Core debt invariant 

For a given branch, the system maintains the following invariant:

**Aggregate total debt of a branch always equals the sum of individual entire Trove debts**.

That is:

```
ActivePool.aggRecordedDebt + ActivePool.calcPendingAggInterest()
+ ActivePool.aggBatchManagementFees() + ActivePool.calcPendingAggBatchManagementFee()
+ DefaultPool.BoldDebt
= SUM_i=1_n(TroveManager.getEntireTroveDebt())
```

For all `n` Troves in the branch.

It can be shown mathematically that this holds (TBD).

### Applying and minting pending aggregate interest 

Pending aggregate interest is “applied” upon most system actions. That is:

- The  `aggRecordedDebt` is updated - the pending aggregate interest is calculated and added to `aggRecordedDebt`, and the `lastDebtUpdateTime` is updated to now.

- The pending aggregate interest is minted by the ActivePool as fresh BOLD. This is considered system “yield”.  A fixed part (72%, final value TBD) of it is immediately sent to the branch’s SP and split proportionally between depositors, and the remainder is sent to a router to be used as LP incentives on DEXes (determined by governance).

This is the only way BOLD is ever minted as interest. Applying individual interest to a Trove updates its recorded debt, but interest is always minted in aggregate.


### Redemption evasion mitigation

In healthy system states (TCR > CCR) a borrower may adjust their Trove’s interest rate or debt at any time, as well as close their Trove. As such, a borrower may evade a redemption transaction by either frontrunning it with an interest rate adjustment, or closing and reopening their Trove. Both "hard" and "soft" frontrunning are viable: savvy borrowers may watch the mempool for redemption transactions, or simply watch the BOLD peg, and take evasive action when it is below $1 and redemptions are likely imminent.

To disincentivize redemption evasion, two upfront fees are implemented: a borrowing fee, as well as a premature interest rate adjustment fee.

### Upfront borrowing fees

An upfront borrowing fee is applied when a borrower:
- Opens a Trove
- Increases the debt of their Trove

The creates a cost for the borrower seeking to evade a redemption by closing and reopening their trove.

The upfront borrowing fee is equal to 7 days of average interest on the respective collateral branch. It is charged in BOLD and is added to the Trove's debt.

### Premature adjustment fees

Since redemptions are performed in order of Troves’ user-set interest rates, a “premature adjustment fee” mechanism is in place. Without it, low-interest rate borrowers could evade redemptions by sandwiching a redemption transaction with both an upward and downward interest rate adjustment, which in turn would unduly direct the redemption against higher-interest borrowers.

The premature adjustment fee works as so:

- When a Trove is opened, its `lastInterestRateAdjTime` property is set equal to the current time
- When a borrower adjusts their interest rate via `adjustTroveInterestRate` the system checks that the cooldown period has passed since their last interest rate adjustment 
- If the adjustment is sooner it incurs an upfront fee (equal to 7 days of average interest of the respective branch) which is added to their debt.

#### Batches and premature adjustment fees

##### Joining a batch
When a trove joins a batch, it pays an upfront fee if the last trove adjustment was done more than the cool period ago. It does’t matter if the Trove and batch have the same interest rate, or when was the last adjustment by the batch.

The last interest rate timestamp will be updated to the time of joining.

Batch interest rate changes only take into account global batch timestamps, so when the new batch manager changes the interest rate less than the cooldown period after the borrower moved to the new batch, but more than the cooldown period after its last adjustment, the newly joined borrower wouldn't pay the upfront fee despite the fact that his last interest rate change happened less than the cooldown period ago.

That’s why Troves pay upfront fee when joining even if the interest is the same. Otherwise a trove may game it by having a batch created in advance (with no recent changens), joining it and the changing the rate of the batch.

##### Leaving a batch
When a trove leaves a batch, the user's timestamp is again reset to the current time.
No upfront fee is charged, unless the interest rate is changed in the same transaction and either the batch changed the interest rate, or the trove joined the batch, less than the cooldown period ago.

##### Switching batches
As the function to switch batches is just a wrapper that calls the functions for leaving and joining a batch, this means that switching batches always incurs in upfront fee now (unless user doesn’t use the wrapper and waits for 1 week between leaving and joining).

## Supplying Hints to Trove operations

Troves in Liquity are recorded in a sorted doubly linked list, sorted by their annual interest, from high to low.

All interest rate adjustments need to either insert or reinsert the Trove to the SortedTroves list. To reduce the computational complexity (and gas cost) of the insertion to the linked list, two ‘hints’ may be provided.

A hint is the address of a Trove with a position in the sorted list close to the correct insert position.

All Trove operations take two ‘hint’ arguments: a `_lowerHint` referring to the nextId and an `_upperHint` referring to the prevId of the two adjacent nodes in the linked list that are (or would become) the neighbors of the given Trove. Taking both direct neighbors as hints has the advantage of being much more resilient to situations where a neighbor gets moved or removed before the caller's transaction is processed: the transaction would only fail if both neighboring Troves are affected during the pendency of the transaction.

The better the ‘hint’ is, the shorter the list traversal, and the cheaper the gas cost of the function call. `SortedList.findInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId)` that is called by the Trove operation firsts check if prevId is still existent and valid (larger interest rate than the provided `_annualInterestRate`) and then descends the list starting from `_prevId`. If the check fails, the function further checks if `_nextId` is still existent and valid (smaller interest rate than the provided `_annualInterestRate`) and then ascends list starting from `_nextId`.

The `HintHelpers.getApproxHint(...)` function can be used to generate a useful hint pointing to a Trove relatively close to the target position, which can then be passed as an argument to the desired Trove operation or to SortedTroves.findInsertPosition(...) to get its two direct neighbors as ‘exact‘ hints (based on the current state of the system).

`getApproxHint(uint256 _collIndex, uint256 _interestRate, uint256 _numTrials, uint256 _inputRandomSeed)` randomly selects`_ numTrials` amount of Troves for a given branch, and returns the one with the closest position in the list to where a Trove with an annual _interestRate should be inserted. It can be shown mathematically that for `numTrials = k * sqrt(n)`, the function's gas cost is with very high probability worst case O(sqrt(n)) if k >= 10. For scalability reasons, the function also takes a random seed `_inputRandomSeed` to make sure that calls with different seeds may lead to different results, allowing for better approximations through multiple consecutive runs.

#### Trove operation without a hint

1. User performs Trove operation in their browser
2. Call the Trove operation with _lowerHint = _upperHint = userAddress

Gas cost will be worst case O(n), where n is the size of the SortedTroves list.

#### Trove operation with hints

1. User performs Trove operation in their browser
2. Front end calls HintHelpers.getApproxHint(...), passing it the annual interest rate Returns an address close to the correct insert position
3. Call SortedTroves.findInsertPosition(uint256 _annualInterestRate, address _prevId, address _nextId), passing it the same approximate hint via both _prevId and _nextId and the new _annualInterestRate.
4. Pass the ‘exact‘ hint in the form of the two direct neighbors, i.e. `_nextId` as `_lowerHint` and `_prevId` as `_upperHint`, to the Trove operation function call. (Note that the hint may become slightly inexact due to pending transactions that are processed first, though this is gracefully handled by the system that can ascend or descend the list as needed to find the right position.)

Gas cost of steps 1-2 will be free, and step 5 will be O(1).

Hints allow cheaper Trove operations for the user, at the expense of a slightly longer time to completion, due to the need to await the result of the two read calls in steps 1 and 2 - which may be sent as JSON-RPC requests to a node provider such as Infura, unless the frontend operator is running a full Ethereum node.

### Example openTrove transaction with hints
```
  const BOLDAmount = toBN(toWei('2500')) // borrower wants to withdraw 2500 BOLD
  const colll = toBN(toWei('5')) // borrower wants to lock 5 collateral tokens
  const interestRate = toBn(toWei(‘7’) // Borrower wants a 7% annual interest rate

  // Get an approximate address hint from the deployed HintHelper contract. Use (15 * sqrt(number of troves)) trials
  // to get an approx. hint that is close to the right position.
  let numTroves = await sortedTroves.getSize()
  let numTrials = numTroves.mul(toBN('15'))
  let { 0: approxHint } = await hintHelpers.getApproxHint(interestRate, numTrials, 42)  // random seed of 42

  // Use the approximate hint to get the exact upper and lower hints from the deployed SortedTroves contract
  let { 0: upperHint, 1: lowerHint } = await sortedTroves.findInsertPosition(interestRate, approxHint, approxHint)

  // Finally, call openTrove with the exact upperHint and lowerHint
  const maxFee = '5'.concat('0'.repeat(16)) // Slippage protection: 5%
  await borrowerOperations.openTrove({otherParams}, upperHint, upperHint)
```


## BOLD Redemptions

Any BOLD holder (whether or not they have an active Trove) may redeem their BOLD directly with the system. Their BOLD is exchanged for a mixture of collaterals at face value: redeeming 1 BOLD token returns $1 worth of collaterals (minus a dynamic redemption fee), priced at their current market values according to their respective oracles. Redemptions have two purposes:


1. When BOLD is trading at <$1 on the external market, arbitrageurs may redeem `$x` worth of BOLD for `>$x` worth of collaterals, and instantly sell those collaterals to make a profit. This reduces the circulating supply of BOLD which in turn should help restore the $1 BOLD peg.


2. Redemptions improve the relative health of the least healthy collateral branches (those with greater "outside" debt, i.e. debt not covered by their SP).


## Redemption routing

<img width="742" alt="image" src="https://github.com/user-attachments/assets/6df3b8bf-ccd8-4aa0-9796-900ea808a352">


Redemptions are performed via the `CollateralRegistry.redeemCollateral` endpoint. A given redemption may be routed across several collateral branches.

A given BOLD redemption is split across branches according in proportion to the **outside debt** of that branch, i.e. (pseudocode):

`redeem_amount_i = redeem_amount * outside_debt_i / total_outside_debt`

Where `outside_debt_i` for branch i is given by `bold_debt_i  - bold_in_SP_i`.

That is, a redemption reduces the outside debt on each branch by the same percentage.

_Example: 2000 BOLD is redeemed across 4 branches_

<img width="704" alt="image" src="https://github.com/user-attachments/assets/21afcc49-ed50-4f3e-8b36-1949cd7a3809">

As can be seen in the above table and proven in generality (TBD), the outside debt is reduced by the same proportion in all branches, making redemptions path-independent.


[TODO - GRAPH BRANCH REDEMPTION]


## Redemptions at branch level

When BOLD is redeemed for collaterals, the system cancels the BOLD with debt from Troves, and the corresponding collateral is removed.

In order to fulfill the redemption request on a given branch, Troves are redeemed from in ascending order of their annual interest rates.

A redemption sequence of n steps will fully redeem all debt from the first n-1 Troves, and, and potentially partially redeem from the final Trove in the sequence.


Redemptions are skipped for Troves with ICR  < 100%. This is to ensure that redemptions improve the ICR of the Trove.

Unredeemable troves are also skipped - see [unredeemable Troves section](#unredeemable-troves).

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

_(*as long as TCR > 100%. If TCR < 100%, then normal redemptions would lower the TCR, but the shutdown threshold is set above 100%, and therefore the branch would be shut down first. See the [shutdown section](#shutdown-logic) )_


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

## Redistributions

When a liquidation occurs and the Stability Pool is empty or smaller than the liquidated debt, the redistribution mechanism distributes the remaining collateral and debt of the liquidated Trove, to all active Troves in the system, in proportion to their collateral.

Redistribution is performed in a gas-efficient O(1) manner - that is, rather than updating the `coll` and `debt` properties on every Trove (prohibitive due to gas costs),  global tracker sums `L_Coll` and `L_boldDebt` are updated, and each Trove records snapshots of these at every touch. A Trove’s pending redistribution gains are calculated using these trackers, and are incorporated in `TroveManager.getEntireDebtAndColl`.

When a borrower touches their Trove, redistribution gains are applied - i.e. added to their recorded `coll` and `debt` - and its tracker snapshots are updated.

This is the standard Batog / UniPool reward distribution scheme common across DeFi.

A Trove’s redistribution gains can also be applied permissionlessly (along with accrued interest) using the function `applyTroveInterestPermissionless`. Similarly, batch redistribution gains can be applied with `applyBatchInterestAndFeePermissionless`.


### Redistributions and Corrected Stakes


For two Troves A and B with collateral `A.coll > B.coll`, Trove A should earn a bigger share of the liquidated collateral and debt.

It important that (for a given branch) the entire collateral always backs all of the debt. That is, collateral received by a Trove from redistributions should be taken into account at _future_ redistributions.


However, when it comes to implementation, Ethereum gas costs make it too expensive to loop over all Troves and write new data to storage for each one. When a Trove receives redistribution gains, the system does not update the Trove's collateral and debt properties - instead, the Trove’s redistribution gains remain "pending" until the borrower's next operation.

It is difficult to account for these “pending redistribution gains” in _future_ redistributions calculations in a scalable way, since we can’t loop over and update the recorded collateral of each Trove one-by-one.

Consider the case where a new Trove is created after all active Troves have received a redistribution from a liquidation. This “fresh” Trove has then experienced fewer rewards than the older Troves, and thus, it would receive a disproportionate share of subsequent redistributions, relative to its total collateral.

The fresh Trove would earn gains based on its entire collateral, whereas old Troves would earn rewards based only on some portion of their collateral - since a part of their collateral is pending, and not included in the old Trove’s `coll` property.

### Corrected Stake Solution

We use a corrected stake to account for this discrepancy, and ensure that newer Troves earn the same liquidation gains per unit of total collateral, as do older Troves with pending redistribution gains.
 
When a Trove is opened, its stake is calculated based on its collateral, and snapshots of the entire system collateral and debt which were taken immediately after the last liquidation.

A Trove’s stake is given by:

`stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot)`

Essentially, we scale new stakes down after redistribution, rather than increasing all older stakes by their collateral redistribution gain.


The Trove then earns redistribution gains based on this corrected stake. A newly opened Trove’s stake will be less than its raw collateral, if the system contains active Troves with pending redistribution gains when it was made.

Whenever a borrower adjusts their Trove’s collateral, their pending rewards are applied, and a fresh corrected stake is computed.

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

A Trove owner may set an individual delegate at any point after opening.The individual delegate has permission to update the Trove’s interest rate in a range set by the owner, i.e. `[ _minInterestRate,  _maxInterestRate]`.  

A Trove can not be in a managed batch if it has an individual interest delegate. 

The Trove owner may also revoke individual delegate’s permission to change the given Trove’s interest rate at any point.

### Batch interest managers

A Trove owner may set a batch manager at any point after opening. They must choose a registered batch manager. The Trove owner may remove the Trove from the batch at any time.

A batch manager controls the interest rate of Troves under their management, in a predefined range chosen when they register. This range may not be changed after registering, enabling borrowers to know in advance the min and max interest rates the manager could set.

All Troves in a given batch have the same interest rate, and all batch interest rate adjustments update the interest rate for all Troves in the batch.

Batch-management is gas-efficient and O(1) complexity - that is, altering the interest rate for a batch is constant gas cost regardless of the number of Troves. 

### Batch management implementation

In the `SortedTroves` list, batches of Troves are modeled as slices of the linked list. They utilise the new `Batch` data structure and `slice` functionality. A `Batch` contains head and tail properties, i.e. the ends of the list slice.

When a batch manager updates their batch’s interest rate, the entire `Batch` is reinserted to its new position based on the interest rate ordering of the SortedTroves list. 

 ### Internal representation as shared Trove

A batch accrues two kinds of time-based debt increases: normal interest and management fees. Individual Troves in the batch may also accrue redistribution gains (coll and debt), though these remained tracked at the individual Trove level, not at the batch level.

To handle accrued interest and fees in a gas-efficient way, the batch is internally modelled as a single “shared” Trove. 

The system tracks a batch’s `recordedDebt` and `annualInterestRate`. Accrued interest is calculated in the same way as for individual Troves, and the batch’s weighted debt is incorporated in the aggregate sum as usual.

### Batch management fee

The management fee is an annual percentage, and is calculated in the same way as annual interest.  It is initially chosen by the batch manager when they register, and can not be changed for that batch thereafter.

### Batch `recordedDebt` updates

A batch’s `recordedDebt` is updated when:
- a Trove in a batch has it’s debt updated by the borrower
- The batch manager changes the batch’s interest rate
- The pending debt of a Trove in the batch is permissionlessly applied 

The batch-level accrued interest and accrued management fees are calculated and added to the batch's recorded debt, along with any individual changes due to a Trove touch - i.e. the Trove's debt adjustment, and/or application of its pending redistribution debt gain.

### Batch premature adjustment fees

Batch managers incur premature fees in the same manner as individual Troves - i.e. if they adjust before the cooldown period has past since their last adjustment (see [premature adjustment section](#premature-adjustment-fees).

When a borrower adds their Trove to a batch, there is a trust assumption: they expect the batch manager to manage interest rates well and not incur excessive adjustment fees.  However, the manager can commit in advance to a maximum update frequency when they register by passing a `_minInterestRateChangePeriod`.

Generally is expected that competent batch managers will build good reputations and attract borrowers. Malicious or poor managers will likely end up with empty batches in the long-term.

### Batch invariants

Batch Troves are intended to be fundamentally equivalent to individual Troves. That is, if individual Trove A and batch Trove B have identical state at a given time (such as coll, debt, stake, accrued interest, etc) - then they would also have identical state after both undergoing the same operation (coll/debt adjustment, application of interest, receiving a redistribution gain).

Also, since batches are modelled as "virtual Troves", equivalences between a Batch and an equivalent individual Trove hold across identical operations.

A thorough description of these batch Trove invariants is found in the [properties and invariants](https://docs.google.com/spreadsheets/d/1WKEwXsmo_lwVWuJvcy3NmVh0IYogPQ-Z2Ab64HuJzkU/edit?usp=sharing) sheet in yellow.


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

## Collateral choices in Liquity v2

Provisionally, v2 has been developed with the following collateral assets in mind:


- WETH
- WSTETH
- RETH

## Oracles in Liquity v2

Liquity v2 requires accurate pricing in USD for the above collateral assets. 

All oracles are integrated via Chainlink’s `AggregatorV3Interface`, and all oracle price requests are made using its `latestRoundData` function.

#### Terminology

- _**Oracle**_ refers to the external system which Liquity v2 fetches the price from- e.g. "the Chainlink ETH-USD **oracle**".
- _**PriceFeed**_ refers to the internal Liquity v2 system contract which contains price calculations and logic for a given branch - e.g. "the WETH **PriceFeed**, which fetches price data from the ETH-USD **oracle**"

### Choice of oracles and price calculations

Chainlink push oracles were chosen due to Chainlink’s reliability and track record. 

The pricing method for each LST depends on availability of oracles. Where possible, direct LST-USD market oracles have been used. 

Otherwise, composite market oracles have been created which utilise the ETH-USD market feed and an LST-ETH market feed. In the case of the WSTETH oracle, the STETH-USD price and the WSTETH-STETH exchange rate is used.

LST-ETH canonical exchange rates are also used as sanity checks for the more vulnerable LSTs (i.e. lower liquidity/volume).

Here are the oracles and price calculations for each PriceFeed during normal functioning. Note that for WSTETH and RETH, redemptions have separate price calculations from other operations.


| Collateral | Primary Price                                    | Rationale                                                                                                                                                                                                                                   | Redemption Price                                                                                     | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|------------|--------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| WETH       | ETH-USD                                          | The closest there is to a WETH-USD price                                                                                                                                                                                                   | ETH-USD                                                                                             | The closest there is to a WETH-USD price                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| WSTETH     | STETH-USD * WSTETH-STETH_exrate                 | Converts the market STETH-USD price to a WSTETH-USD price. _(Assumes STETH-USD liquidity / market price manipulation is much less of a risk than RETH-ETH market or exchange rate risks, based on discussion with Chainlink.)_                | **if** STETH-USD and ETH-USD within 1%: max(STETH-USD, ETH-USD) * WSTETH-STETH_exrate **else**: STETH-USD * WSTETH-STETH_exrate | Prevent redemption arbs by taking the max of STETH-USD and ETH-USD if STETH-USD is within 1% of ETH-USD. Taking the max prevents oracle lag arbs by giving redeemers the "worst" price. If the oracle prices are >1% apart, then we assume the difference is due to legitimate market price difference between STETH and ETH, so use the STETH price.                                                                                                                                                                                     |
| RETH       | min(RETH-ETH, RETH-ETH_exrate) * ETH-USD        | Converts a RETH-ETH price to a RETH-USD price. Takes the min of the market and exchange rate RETH-ETH prices in order to mitigate against upward price manipulation which would be bad for the system, e.g. could result in excess BOLD minting, undercollateralized Troves and branch insolvency. | **if** RETH-ETH and RETH-ETH_exrate within 2%: max(RETH-ETH, RETH-ETH_exrate) * ETH-USD **else**: min(RETH-ETH, RETH-ETH_exrate) * ETH-USD | Prevent redemption arbs by taking the max of RETH-ETH market price and RETH-ETH exchange rate if the market price is within 2% of the exchange rate. Taking the max prevents oracle lag arbs by giving redeemers the "worst" price. If the oracle prices are >2% apart, then we assume the difference is due to a "legitimate" market price difference (i.e., non-oracle lag at least) between the RETH-ETH market price and the exchange rate. Since this could be due to one being manipulated upward, we take the minimum (as per the normal primary price calculation), which should ensure legitimately profitable redemptions remain so in this case. |

### Mitigating redemption arbitrages / oracle frontrunning

Since market oracles have update thresholds, they will inevitably lag the "true" market price at times - particularly, when their deviation from the market price is less than their update threshold. This may be exploitable for profit. An attack sequence may look like this:

- Observe collateral price increase oracle update in the mempool
- Frontrun with redemption transaction for $x worth of BOLD and receive `$x` - fee worth of collateral
- Oracle price increase update transaction is validated
- Sell redeemed collateral for $y such that `$y > $x`, due to the price increase
- Extracts `$(y-x)` from the system.

 This is “hard” frontrunning: the attacker directly frontrun the oracle price update. “Soft” frontrunning is also possible when the attacker sees the market price increase before even seeing the oracle price update transaction in the mempool.

The value extracted is excessive, i.e. above and beyond the arbitrage profit expected from BOLD peg restoration. In fact, oracle frontrunning can even be performed when BOLD is trading >= $1.

To mitigate this value extraction on RETH and WSTETH branches, the system uses the maximum of a market price and a canonical price in redemptions. This mitigates oracle lag arbitrages by giving the redeemer the "worst" price at any given moment.

The trade-off of this solution that redemptions may sometimes be unprofitable during volatile periods with high oracle lag. However, as long as redemptions do happen eventually and in the long term, then peg maintenance will hold.

However, this "worst price" solution only applies if the delta between market price and canonical price is within the oracle deviation threshold (1% for WSTETH, 2% for RETH). If the difference is greater, then the normal primary pricing calculation is used - a large delta is assumed to reflect a legitimate difference between market price and canonical rate.

### TODO - [INHERITANCE DIAGRAM]


### PriceFeed Deployment 

Upon deployment, the `stalenessThreshold` property of each oracle is set. This is in all cases greater than the oracle’s intrinsic update heartbeat.

### Fetching the price 

When a system branch operation needs to know the current price of collateral, it calls `fetchPrice` on the relevant PriceFeed. 


- If the PriceFeed has already been disabled, return the `lastGoodPrice`. Otherwise:
- Fetch all necessary oracle answers with `aggregator.latestRoundData`
- Verify each oracle answer. If any oracle used is deemed to have failed, disable the PriceFeed and shut the branch down
- Calculate the final LST-USD price (according to table above)
- Store the final LST-USD price and return it 

The conditions for shutdown at the verification step are:

- Call to oracle reverts
- Oracle returns a price of 0
- Oracle returns a price older than its `stalenessThreshold`

Similarly, canonical rates are also checked for failure. Conditions for canonical rate failure are:

- Call to a canonical rate reverts
- Canonical rate returns 0

If the `fetchPrice` call is the top-level call, then failed verification due to any one of the above conditions being met results in the PriceFeed being disabled and the branch is shut down.  

If the `fetchPrice` call is called inside a borrower operation or redemption, then when a shutdown condition is met the transaction simply reverts. This is to prevent operations succeeding when the feed should be shut down. To disable the PriceFeed and shut down the branch, `fetchPrice` should be called directly.


This is intended to catch some obvious oracle and canonical rate failure modes, as well as the scenario whereby the oracle provider disables their feed. Chainlink have stated that they may disable LST feeds if volume becomes too small, and that in this case, the call to the oracle will revert.

### Fallback price calculations if an oracle has failed

#### Canonical exchange rate failure

| Collateral | Fallback if Exchange Rate Fails | Rationale                                                       |
|------------|----------------------------------|-----------------------------------------------------------------|
| WETH       | N/A                              | N/A                                                             |
| WSTETH     | lastGoodPrice                    | The exchange rate is necessary for all primary and fallback price calculations |
| RETH       | lastGoodPrice                    | The exchange rate is necessary for all primary and fallback price calculations |


If a canonical exchange rate has failed, then the best the LST branch can do is use the last good price seen by the system. 


#### ETH-USD market rate failure

Similarly, if the ETH-USD price fails, all branches are eligible to be shut down and will use the last good price:

| Collateral | Fallback if ETH-USD Market Oracle Fails | Rationale                                                                                                                                                                                                                      |
|------------|------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| WETH       | lastGoodPrice                            | Cannot price WETH without it                                                                                                                                                                                                  |
| WSTETH     | lastGoodPrice                            | ETH-USD is necessary for the primary redemption calculation. Also, ETH-USD Chainlink oracle failing would wreck much of DeFi and necessarily shut down both WETH and RETH branches, so it seems safest to also shut down the WSTETH branch too. |
| RETH       | lastGoodPrice                            | ETH-USD is necessary for all primary calculations.                                                                                                                                                                            |

Using an out-of-date price obviously has undesirable consequences, but it’s the best that can be done in this extreme scenario. The impacts are addressed in [Known Issue 4](https://github.com/liquity/bold/blob/main/README.md#4---oracle-failure-and-urgent-redemptions-with-the-frozen-last-good-price).

#### LST market oracle failure

| Collateral | Fallback if LST Market Oracle Fails           | Rationale                                                                                                                                                                                                                  |
|------------|-----------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| WETH       | N/A                                           | N/A                                                                                                                                                                                                                        |
| WSTETH     | min(lastGoodPrice, ETH-USD * WSTETH-STETH_exrate) | We substitute the ETH-USD market price if the latter oracle fails. We take the min with the lastGoodPrice to ensure the system always gives the best redemption price, even if it gives "too much" collateral away to the redeemer. The goal is to clear debt from the shutdown branch ASAP. |
| RETH       | min(lastGoodPrice, ETH-USD * RETH-ETH_exrate) | We substitute the RETH-ETH_exrate for the RETH-ETH market price if the latter oracle fails. As above, take the min to clear debt from the branch ASAP.                                                                     |

If a branch is using a primary price calculation and the LST market oracle fails, then the system attempts to create a composite price from the ETH-USD market oracle and the exchange rate.

Note that in all failure cases when a branch shuts down, there is thereafter no separate redemption pricing - we are not concerned with preventing redemption arbs in a shut down branch.  The goal in all shut down branches is to clear the remaining debt ASAP.

### Protection against upward market price manipulation

The smaller LST i.e. RETH has lower liquidity and thus it is cheaper for a malicious actor to manipulate their market price.

The impacts of downward market manipulation are bounded - it could result in excessive liquidations and branch shutdown, but should not affect other branches nor BOLD stability.

However, upward market manipulation could be catastrophic as it would allow excessive BOLD minting from Troves, which could cause a depeg.

The system mitigates this by taking the minimum of the LST-USD prices derived from market and canonical rates on the RETHPriceFeed. As such, to manipulate the system price upward, an attacker would need to manipulate both the market oracle _and_ the canonical rate which would be much more difficult.


However this is not the only LST/oracle risk scenario. There are several to consider - see the [LST oracle risks section](#9---lst-oracle-risks).


## Known issues and mitigations

### 1 - Oracle price frontrunning

Push oracles are used for all collateral pricing. Since these oracles push price update transactions on-chain, it is possible to frontrun them with redemption transactions.

An attack sequence may look like this:

- Observe collateral price increase oracle update in the mempool
- Frontrun with redemption transaction for `$x` worth of BOLD and receive `$x - fee` worth of collateral
- Oracle price increase update transaction is validated
- Sell redeemed collateral for `$y` such that `$y > $x`, due to the price increase
- Extracts `$(y-x)` from the system.

This is “hard” frontrunning: the attacker directly frontrun the oracle price update. “Soft” frontrunning is also possible when the attacker sees the market price increase before even seeing the oracle price update transaction in the mempool.

The value extracted is excessive, i.e. above and beyond the arbitrage profit expected from BOLD peg restoration. In fact, oracle frontrunning can even be performed when BOLD is trading >= $1.

In Liquity v1, this issue was largely mitigated by the 0.5% minimum redemption fee which matched Chainlink’s ETH-USD oracle update threshold of 0.5%.

In v2, some oracles used for LSTs have larger update thresholds - e.g. Chainlink’s RETH-ETH, at 2%.

However, we don’t expect oracle frontrunning to be a significant issue since these LST-ETH feeds are historically not volatile and rarely deviate by significant amounts: they usually update based on the heartbeat (mininum update frequency) rather than the threshold.

 Still several solutions were considered. Here are some:

| Solution                                                                                  | Challenge                                                                                                                                                   |
|-------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Low latency pull-based oracle                                                             | Mainnet block-time introduces a lower bound for price staleness. According to Chainlink, during high vol periods, these oracles may not be fast enough on mainnet |
| Custom 2-step redemptions: commit-confirm pattern, redeemer confirms                      | Price uncertainty for legitimate redemption arbers. Could discourage legitimate redemptions                                                                 |
| 2-step redemptions with pull-based oracle. Commit-confirm pattern, keeper confirms        | Price uncertainty for legitimate redemption arbers. Could discourage legitimate redemptions                                                                 |
| Canonical rate oracle (ETH-USD_market x LST_ETH_canonical) for redemptions                | Likely fixes the issue - though in case of canonical rate manipulation, redemptions would be unprofitable (upward manipulation) or pay too much collateral (downward manipulation) |
| Canonical rate oracle (ETH-USD_market x LST_ETH_canonical) for redemptions, with upward and downward protection (e.g. Aave) | Likely fixes the issue - but cap parameters may be hard to tune, and could not be changed                                                                  |
| Adapt redemption fee parameters (fee spike gain, fee decay half-life)                     | Hard to tune parameters                                                                                                                                     |

#### Solution 

To mitigate this value extraction on RETH and WSTETH branches, the system uses the maximum of a market price and a canonical price in redemptions. This mitigates oracle lag arbitrages by giving the redeemer the "worst" price at any given moment. 

However, this only applies if the delta between market price and canonical price is within the oracle deviation threshold (1% for WSTETH, 2% for RETH). If the difference is greater, then the normal primary pricing calculation is used - a large delta is assumed to reflect a legitimate difference between market price and canonical rate.


### 2 - Bypassing redemption routing logic via temporary SP deposits

The redemption routing logic reduces the “outside” debt of each branch by the same percentage, where outside debt for branch `i` is given by:

`outside_debt_i = bold_debt_i  - bold_in_SP_i`.

It is clearly possible for a redeemer to temporarily manipulate the outside debt of one or more branches by depositing to the SP.

Thus, an attacker could direct redemptions to their chosen branch(es) by depositing to SPs in branches they don’t wish to redeem from. 

This sequence - deposit to SPs on unwanted branches, then redeem from chosen branch(es) -  can be performed in one transaction and a flash loan could be used to obtain the BOLD funds for deposits.

By doing this redeemer extracts no extra value from the system, though it may increase their profit if they are able to choose LSTs to redeem which have lower slippage on external markets.
The manipulation does not change the fee the attacker pays (which is based purely on the `baseRate`, the redeemed BOLD and the total BOLD supply).

#### Solution

Currently no fix is in place, because:

- The redemption arbitrage is highly competitive, and flash loan fees reduce profits (though, the manipulation could still result in a greater profit as mentioned above)
- There is no direct value extraction from the system
- Redemption routing is not critical to system health. It is intended as a soft measure to nudge the system back to a healthier state, but in the end the system is heavily reliant on the health of all collateral markets/assets.

### 3 - Path-dependent redemptions: lower fee when chunking

The redemption fee formula is path-dependent: that is, given some given prior system state, the fee incurred from redeeming one big chunk of BOLD in a single transaction is greater than the total fee incurred by redeeming the same BOLD amount in many smaller chunks with many transactions (assuming no other system state change in between chunks).

As such, redeemers may be incentivized to split their redemption into many transactions in order to pay a lower total redemption fee.

See this example from this sheet:
https://docs.google.com/spreadsheets/d/1MPVI6edLLbGnqsEo-abijaaLnXle-cJA_vE4CN16kOE/edit?usp=sharing



#### Solution

No fix is deemed necessary, since:

- Redemption arbitrage is competitive and profit margins are thin. Chunking redemptions incurs a higher total gas cost and eats into arb profits.
- Redemptions in Liquity v1 (with the same fee formula) have broadly functioned well, and proven effective in restoring the BOLD peg.
- The redemption fee spike gain and decay half-life are “best-guess” parameters anyway - there’s little reason to believe that even the intended fee scheme is absolutely optimal.

### 4 - Oracle failure and urgent redemptions with the frozen last good price

An ETH-USD market oracle failure and/or a canonical LST exchange rate failure trigger branch shutdowns which then and thereafter use the `lastGoodPrice` to price the branch's collateral.

During shutdown, the only operation that uses the LST price is urgent redemptions.   

When `lastGoodPrice` is used to price the LST, the _real_ market price may be higher or lower. This leads the following distortions:

| Scenario                     | Consequence                                                                                                                                       |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| lastGoodPrice > market price | Urgent redemptions return too little LST collateral, and may be unprofitable even when BOLD trades at $1 or below                                   |
| lastGoodPrice < market price | Urgent redemptions return too much LST collateral. They may be too profitable, compared to the market price.              |

#### Solution

No fix is implemented for this, for the following reasons:

- In the second case, although urgent redemptions return too much value to the redeemer, they can still clear all debt from the branch.
- In the first case, the final result is that some uncleared BOLD debt remains on the shut down branch, and the system carries this unbacked debt burden going forward.  This is an inherent risk of a multicollateral system anyway, which relies on the economic health of the LST assets it integrates.
- Also an Oracle failure, if it occurs, will much more likely be due to a disabled Chainlink feed rather than hack or technical failure. A disabled LST oracle implies an LST with low liquidity/volume, which in turn probably implies that the LST constitutes a small fraction of total Liquity v2 collateral.

### 5 - Stale oracle price before shutdown triggered

Liquity v2 checks all returned market oracle answers for staleness, and if they exceed a pre-set staleness threshold, it shuts down their associated branch.

However, in case of a stale oracle (i.e. an oracle that has not updated for longer than it’s stated heartbeat), then in the period between the last oracle update and the branch shutdown, the Liquity v2 system will use the latest oracle price which may be out of date.

The system could experience distortions in this period due to pricing collateral too low or too high relative to the real market price. Unwanted arbitrages and operations may be possible, such as:

- Redeeming too profitably or unprofitably
- Borrowing (and selling) BOLD with too little collateral provided
- Liquidation of healthy Troves

#### Solution

Oracle staleness threshold parameters are TBD and should be carefully chosen in order to minimize the potential price deltas and distortions. The ETH-USD (and STETH-USD) feeds should have a lower staleness threshold than the LST-ETH feeds, since the USD feeds are typically much more volatile, and their prices could deviate by a larger percentage in a given time period than the LST-ETH feeds.

All staleness thresholds must be also greater than the push oracle’s update heartbeat.

Provisionally, the preset staleness thresholds in Liquity v2 as follows, though are subject to change before deployment:

| Oracle                                                  | Oracle heartbeat | Provisional staleness threshold (s.t. change) |
|---------------------------------------------------------|------------------|----------------------------------------------|
| Chainlink ETH-USD                                       | 1 hour           | 24 hours                                     |
| Chainlink stETH-USD                                     | 1 hour           | 24 hours                                     |
| Chainlink rETH-ETH                                      | 24 hours         | 48 hours                                     |


### 6 - Batch management ops don’t check for a shutdown branch

Currently, batch management operations such as `setBatchManagerAnnualInterestRate` and `applyBatchInterestAndFeePermissionless` don’t check for branch shutdown. These operations should not be possible on a shutdown branch.

#### Solution
This fix is TODO.


### 7 - Discrepancy between aggregate and sum of individual debts

As mentioned in the interest rate [implementation section](#core-debt-invariant), the core debt invariant is given by:

**Aggregate total debt always equals the sum of individual entire Trove debts**.

That is:

```
ActivePool.aggRecordedDebt + ActivePool.calcPendingAggInterest()
+ ActivePool.aggBatchManagementFees() + ActivePool.calcPendingAggBatchManagementFee()
+ DefaultPool.BoldDebt
= SUM_i=1_n(TroveManager.getEntireTroveDebt())
```

For all `n` Troves in the branch.

However, this invariant doesn't hold perfectly - the aggregate is sometimes slightly less than the sum over Troves. 

#### Solution

Though rounding error is inevitable, we have ensured that the error always “favors the system” - that is, the aggregate is always greater than the sum over Troves, and every Trove can be closed (until there is only 1 left in the system, as intended).

### 8 - Discrepancy between `yieldGainsOwed` and sum of individual yield gains in StabilityPool

StabilityPool increases `yieldGainsOwed` by the amount of BOLD yield it receives from interest minting, and decreases it by the claimed amount any time a depositor makes a claim. As such, `yieldGainsOwed` should always equal the sum of unclaimed yield present in deposits:

`StabilityPool.getYieldGainsOwed() = SUM(StabilityPool.getDepositorYieldGain())`

Currently, the discrepancy between these 2 can be rather large, especially if yield is received immediately after a liquidation that results in very little remaining deposited BOLD in StabilityPool. What's worse, the discrepancy can sometimes be negative, meaning if every depositor were to try and claim their gains, at some point we would try to reduce `yieldGainsOwed` below zero, resulting in arithmetic underflow.

#### Solution

Some imprecision in the StabilityPool arithmetic is inevitable, but we should avoid arithmetic underflow in `yieldGainsOwed` by ensuring the error stays positive. The root cause of the underflow is not yet clear, however it seems to be connected to our error feedback mechanism.

[PR 261](https://github.com/liquity/bold/pull/261) contains a proof-of-concept patch that eliminates error correction while also simplifying the code in an effort make it easier to reason about. This fixes all currently known instances of arithmetic underflow.

**TODO**: we should analyze the issue more and understand the root cause better.

### 9 - LST oracle risks 

Liquity v1 primarily used the Chainlink ETH-USD oracle to price collateral. ETH clearly has very deep liquidity and diverse price sources, which makes this oracle robust.

However, Liquity v2 must also price a variety of LSTs, which comes with challenges:

- LSTs may have thin liquidity and/or low trading volume
- A given LST may trade only on 1-2 venues, i.e. a single DEX pool
- LST smart contract risk: withdrawal bugs, manipulation of canonical exchange rates, etc

Thin liquidity and lack of price source diversity lead to an increased risk of market price manipulation. An attacker could (for example) relatively cheaply tilt the primary DEX pool on which the LST trades, and thus pump or crash the LST price reported by the oracle. 

Liquity v2 would be fully exposed to this risk if it purely relied on LST-USD market price oracles for the riskier LSTs.

An alternative to market price oracles is to calculate a composite LST-USD price using an ETH-USD market oracle and the LST canonical exchange rate from the LST smart contract.

This mitigates against market manipulation since the only market oracle used is the more robust ETH-USD, but then exposes the system to canonical exchange rate manipulation.

Canonical exchange rates are updated in different ways depending on the given LST, and most are controlled by an oracle-like scheme, though some LSTs are moving to trustless zk-proof based updates. Therefore, using canonical rates introduces exchange rate manipulation risk, the magnitude of which is hard to assess for smaller LSTs (does the team abandon the project? do promises to move to zk-proofs materialize? What are the attack costs for the oracle-like canonical rate update?).

Various risk scenarios have been analysed in this sheet for different oracle setups: (see sheet 1, and overview in sheet 2):
https://docs.google.com/spreadsheets/d/1Of5eIKBMVAevVfw5AtbdFpRlMLn8q9vt0vqmtrDhySc/edit?usp=sharing

#### Solution

To mitigate the worst outcome of upward price manipulation, Liquity v2 uses solution 2) - i.e. takes the lower of LST-USD prices derived from an LST market price and the LST canonical rate.

Downward price manipulation is not protected against, however the impact should be contained to the branch (liquidations and shutdown). Also, downward manipulation likely implies a low liquidty LST, which in turn likely implies the LST is a small fraction of total collateral in Liquity v2. Thus the impact on the system and any bad debt created should be small.

On the other hand, upward price manipulation would result in excessive BOLD minting, which is detrimental to the entire system health and BOLD peg.

Taking the minimum of both market and canonical prices means that to make Liquity v2 consume an artificially high LST price, an attacker needs to manipulate both the market oracle _and_ the LST canonical rate at the same time, which seems much more difficult to do.

The best solution on paper seems to be 3) i.e. taking the minimum with an additional growth rate cap on the exchange rate, following [Aave’s approach](https://github.com/bgd-labs/aave-capo). However, deriving parameters for growth rate caps for each LST is tricky, and may not be suitable for an immutable system. 

### 10 - Branch shutdown and bad debt

In the case of a collateral price collapse or oracle failure, a branch will shut down and urgent redemptions will be enabled. The collapsed branch may be left with 0 collateral (or collateral with 0 value), and some remaining bad debt.

This could in the worst case lead to bank runs: a portion of the system debt can not be cleared, and hence a portion of the BOLD supply can never be redeemed.

Even though the entire system may be overcollateralized in aggregate, this unredeemable portion of BOLD is problematic: no user wants to be left holding unredeemable BOLD and so they may dump BOLD en masse (repay, redeem, sell).

This would likely cause the entire system to evaporate, and may also break the BOLD peg. Even without a peg break, a bank run is still entirely possible and very undesirable.

**Potential solutions**

Various solutions have been fielded. Generally, any solution which appears to credibly and eventually clear the bad debt should have a calming effect on any bank run dynamic: when bad debt exists yet users believe the BOLD peg will be maintained in the long-term, they are less likely to panic and repay/redeem/dump BOLD.

1. **Redemption fees pay down bad debt**. When bad debt exists, direct normal redemption fees to clearing the bad debt. It works like this: when `x` BOLD is redeemed, `x-fee` debt on healthy branches is cleared 1:1 for collateral, and `fee` is canceled with debt on the shut down branch. This would slowly pay down the debt over time. It also makes bank runs via redemption nicely self-limiting: large redemption volume -> fee spike -> pays down the bad debt more quickly. 

2. **Haircut for SP depositors**. If there is bad debt in the system, BOLD from all SPs could be burned pro-rata to cancel it.  This socializes the loss across SP depositors.

3. **Redistribution to active Troves on healthy branches**. Socializes the loss across Troves. Could be used as a fallback for 2.

4. **New multi-collateral Stability Pool.** This pool would absorb some fraction of liquidations from all branches, including shut down branches. 

5. **Governance can direct BOLD interest to pay down bad debt**. BOLD interest could be voted to be redirected to paying down the bad debt over time.  Although this would not directly clear the bad debt, economically, it should have the same impact  - since ultimately, it is the redeemability of _circulating_ BOLD that determines the peg.  When an amount equal to the bad debt has been burned, then all circulating BOLD is fully redeemable. See this example:

<img width="537" alt="image" src="https://github.com/user-attachments/assets/3045cba9-45a3-46b4-a5d0-58bed7f38a04">

This provides a credible way of eventually "filling the hole" created by bad debt (unlike other approaches such as the SP haircut, which depends on SP funds). No additional core system code nor additional governance features are required. Governance may simply propose to redirect BOLD interest to a burn address. 

If there is remaining collateral in the shutdown branch (albeit perhaps at zero USD value) and there are liquidateable Troves, Governance could alternatively vote to direct fees to a permissionless contract that deposits the BOLD to the SP of the shutdown branch and liquidates the Troves against those funds. The resulting collateral gains could, if they have non-zero value, be swapped on a DEX, e.g. for BOLD which could be then directed to LP incentives. All deposits and swaps could be handled permissionlessly by this governance-deployed contract.

And some additional solutions that may help reduce the chance of bad debt occurring in the first place:

6. **Restrict SP withdrawals when TCR < 100%**. This ensure that SP depositors can’t flee when their branch is insolvent, and would be forced to eat the loss. This could lead to less bad debt than otherwise. On the other hand, when TCR > 100%, the expectation of this restriction kicking in could force pre-empting SP fleeing, which may limit liquidations and make bad debt _more_ likely.  An alternative would be to restrict SP withdrawals only when the LST-ETH price falls significantly below 1, indicating an adverse LST depeg event.

7. **Pro-rata redemptions at TCR < 100% (branch specific, not routed)**. Urgent redemptions are helpful for shrinking the debt of a shut down branch when it is at `TCR > 100%`. However, at `TCR < 100%`, urgent redemptions do not help clear the bad debt. They simply remove all collateral and push it into its final state faster (and in fact, make it slightly worse since they pay a slight collateral bonus).  At `TCR < 100%`, we could offer special pro-rata redemptions only on the shut down branch - e.g. at `TCR = 80%`, users may redeem 1 BOLD for $0.80 worth of collateral. This would (in principle) allow someone to completely clear the bad debt via redemption. At first glance it seems unprofitable, but if the redeemer has reason to believe the collateral is underpriced and the price may rebound at some point in future, they may believe it to be profitable to redeem pro-rata.

**Conclusion**

Ultimately, no measures have been implemented in the protocol directly, so the protocol may end up with some bad debt in the case of a branch shut down.  Here there is a theoretical possibility that the BOLD supply may be reduced by either users accidentally burning BOLD, or that borrower's interest could be directed by governance to burn BOLD, which would restore its backing over time.

### 11 - Inaccurate calculation of average branch interest rate

`getNewApproxAvgInterestRateFromTroveChange` does not actually calculate the correct average interest rate for a collateral branch. Ideally, we would like to calculate the debt-weighted average interest of all Troves within the branch, upon which our calculation of the upfront fee is based. The desired formula would be:

```
        sum(r_i * debt'_i)
r_avg = -----------------
           sum(debt'_i)
```

where `r_i` and `debt'_i` are the interest rate and _current_ debt of the i-th Trove, respectively. Here, `debt'_i` includes pending interest.

However, in the actual implementation as Dedaub points out: in the denominator "the pending interest of all the troves is added", however the numerator "takes into account only the change in the Trove under consideration and not the pending interest of all the other troves". Thus, the actual implementation is closer to (disregarding the upfront fee that applies to the Trove being adjusted):

```
         sum(r_i * debt_i)
r'_avg = -----------------
            sum(debt'_i)
```

where `debt_i` is the debt of the i-th Trove when it was last adjusted, in other words: excluding pending interest. As we see, there's a discrepancy in weights between the numerator and denominator of our weighted average formula. As the sum of weights in the denominator is greater than the sum of weights in the numerator, our estimate of the average interest rate will be lower than the ideal average.

Roughly speaking: if `s` is the current total debt of a collateral branch and `p` the total amount of interest that hasn't been compounded yet, our estimate will be off by a factor of `s / (s + p)`.

#### Side-note: "discrete" compounding in v2

By design, Trove debt in Liquity v2 is compounded "discretely", that is: whenever an operation directly modifies a Trove (such as a borrower making a Trove adjustment, or a Trove getting redeemed). Compounding only takes place for the Trove(s) "touched" by an operation, thus, each Trove has an individual timestamp (`lastDebtUpdateTime`) of the time when the Trove's debt was last compounded.

#### Potential improvement 1

One way to fix the above-mentioned discrepancy between the numerator and the denominator would be to take into account pending interest in the former. As mentioned before, the current definition of the numerator is:

```
sum(r_i * debt_i)
```

`ActivePool` keeps track of this sum in an O(1) fashion on-chain as `aggWeightedDebtSum`. To take into account pending interest, the numerator would have to be changed to:

```
sum(r_i * debt'_i) = sum(r_i * debt_i) + sum(r_i * debt_i * dT_i)
```

where `dT_i` is `block.timestamp - lastDebtUpdateTime`, i.e. the time elapsed since the i-th Trove was last compounded. While it seems possible to do so in O(1) complexity, `ActivePool` currently doesn't keep track of this metric. Thus without additional accounting (keeping track of the sum in a new state variable), it would take O(N) time to calculate the ideal numerator.

#### Potential improvement 2

Alternatively, we could modify the denominator to ignore pending debt instead. Currently, we use:

```
sum(debt'_i)
```

which is kept track of as `aggRecordedDebt` by `ActivePool`. Instead, we could use:

```
sum(debt_i)
```

While this wouldn't result in the most accurate estimation of the average interest rate either — considering we'd be using outdated debt values sampled at different times for each Trove as weights — at least we would have consistent weights in the numerator and denominator of our weighted average. To implement this though, we'd have to keep track of this modified sum (i.e. the sum of recorded Trove debts) in `ActivePool`, which we currently don't do.

### 12 - TroveManager can make troves liquidatable by changing the batch interest rate
Users that add their Trove to a Batch are allowing the BatchManager to charge a lot of fees by simply adjusting the interest rate as soon as they can via `setBatchManagerAnnualInterestRate`.

This change cannot result in triggering the critical threshold, however it can make any trove in the batch liquidatable

Thus BatchManagers should be considered benign trusted actors

### 13 - Trove Adjustments may be griefed by sandwich raising the average interest rate

Borrowing requires accepting an upfront fee. This is effectively a percentage of the debt change (not necessarily of TCR due to price changes). Due to this, it is possible for other ordinary operations to grief a Trove adjustments by changing the `avgInterestRate`.

To mitigate this, users should use tight but not exact checks for the `_maxUpfrontFee`.

### 14 - Stability Pool claiming and compounding Yield can be used to gain a slightly higher rate of rewards
The StabilityPool doesn't automatically compound Bold yield gains to depositors

All deposits are added to `totalBoldDeposits`.

Claimable yields are not part of `totalBoldDeposits`.

Claiming bold allows to receive the corresponding yield and it does increase `totalBoldDeposits`.

If we compare a deposit that never claims, against one that compound their claims.

The depositor compounding their claims will technically receive the rewards that could have been received by the passive depositor.

Meaning that claiming frequently is the preferred strategy.

### 15. Urgent Redemptions Premium can worsen the ICR when Trove Coll Value < Debt Value * .1
If ICR is less than 101% , urgent redemptions with 1% premium reduce the ICR of a Trove.

This may be used to lock in a bit more bad debt.

Liquidations already carry a collateral premium to the caller and to the liquidators.

Redemptions at this CR may allow for a bit more bad debt to be redistributed which could cause a liquidation cascade, however the difference doesn't seem particularly meaningful when compared to how high the Liquidation Premium tends to be for liquidations.

### 16 - Oracle code nitpicks

Two informational issues are present in the oracle code which have no impact on core system operation or logic.

- The `WETHPriceFeed` contains one unused internal function - `_fetchPricePrimary(bool _isRedemption)`. Unlike the LST feeds, this PriceFeed in fact does not need to know whether the operation is a redemption, since it uses the ETH-USD market price for all operations via the internal function `_fetchPricePrimary()`.  

-The `RETHPriceFeed` contains a misnamed variable on L39 and L60. `rEthPerEth` should rather be named `ethPerReth`. However, its _value_ is assigned correctly from the external call to `getExchangeRate` (which returns an ETH per RETH value). It is also _used_ correctly, as per the arithmetic in comment on L59. It is only named incorrectly.

### 17 - Path dependence of redistributions - sequential vs batch liquidations

Liquidations via redistribution in `batchLiquidateTroves` do not distribute liquidated collateral and debt to the other Troves liquidated inside the liquidation loop. They only distribute collateral and debt to the active Troves which remain in the system after all liquidations in the loop have been resolved.

#### Consequences

All else equal, this leads to a slightly different end state when comparing the redistribution of a given set of Troves by a single batch liquidation to separate redistributions of those same Troves.

Consider a system of Troves A,B,C,D,E.  A,B,C have `ICR < MCR` and are thus liquidateable.  D and E have `ICR > MCR` and are healthy.


#### Scenario 1 - batch redistribution

If A,B and C are redistributed in one `batchLiquidateTroves` call, the collateral and debt of A,B, and C is given purely to D and E (sans the collateral gas compensation of each).

#### Scenario 2 - sequential redistribution

However, if A, B and C are redistributed by sequential liquidation calls, then, collateral and debt is first “rolled” forward to the next Trove in the sequence, before finally being distributed to remaining active Troves D and E. That is:


```
batchLiquidateTroves(A)
-> B,C,D,E receive A’s debt and coll proportionally
batchLiquidateTroves(B)
-> C,D,E receive B’s debt and coll proportionally
batchLiquidateTroves(C)
-> D,E receive C’s debt and coll proportionally
```

The end result is _almost_ the same: D and E receive all debt and coll of A,B and C sans collateral gas compensation. However, the total gas compensation paid out differs between scenario 1 and 2 - and thus the total collateral D and E receive differs slightly too.

#### Scenario 1 gas compensation

In scenario 1, gas compensation for each liquidated Trove i is computed based on the Trove’s collateral **prior** to the `batchLiquidateTroves` call i.e. `coll_i`. Gas compensation is summed over all liquidated Troves and paid at the end.

For simplicity let `gas_comp()` be the function that determines the collateral gas compensation of a given Trove. The formula is:

gas_comp(coll_i) = `0.0375 WETH + min(0.5% * coll_i, 2_units_of_LST).`

i.e. it is linearly increasing with trove collateral up to the point where `coll_i == 400_units_of_LST`, beyond which it is constant.

So in scenario 1:


`total_gas_comp_1  = gas_comp(coll_A) + gas_comp(coll_B) + gas_comp(coll_C)`

#### Scenario 2 gas compensation

In scenario 2, the collateral of all remaining Troves increases after each sequential liquidation.

Since A is liquidated first it receives no redistribution shares, so A’s liquidated collateral is the same as in scenario 1, i.e. `coll_A`.

However B and C’s collateral does increase before they get liquidiated. Let:


coll_B’ denote B’s increased collateral after liquidation of A, so  `coll_B’ > coll_B`
coll_C’ denote C’s increased collateral after liquidation of A, so `coll_C’ > coll_C`

In the sequence:


```
liquidate(A)
-> pay gas compensation to liquidator. B and C’s collateral increases by their shares of A’s collateral
liquidate(B)
-> pay gas compensation to liquidator based on B’s increased collateral, coll_B’
liquidate(C)
-> D,E receive C’s debt and coll proportionally
```

Here, the total gas comp paid is:

`total_gas_comp_2  = gas_comp(coll_A) + gas_comp(coll_B’) + gas_comp(coll_C’)`

And since `gas_comp()` is a linear increasing function of collateral (for troves under 400 units of LST collateral), then it can be that `total_gas_comp_2 > total_gas_comp_1`.

#### Impact summary

In a batch liquidation where 1 or more Troves somewhere in the middle of (i.e. not first or last) the `batchLiquidateTroves` loop have under 400 units of LST collateral, then the remaining active Troves after the call receive slightly **less** collateral from the redistribution than in the case where the Troves are liquidated individually and sequentially. Accordingly,  the liquidator also receives slightly **more** gas compensation.

#### Design choice: no rolling redistributions inside `batchLiquidateTroves`

The choice to make `batchLiquidateTroves` behave as it does - i.e. to not roll debt and collateral shares through to other Troves inside its liquidation loop - was conscious and deliberate.

The current approach is more gas efficient and makes the code simpler to reason about than inner rolling liquidations.

The discrepancy between batch and sequential liquidation gas compensation is minor, and does not have negative consequences for the system. Collateral gas compensation is in any case an arbitrary design choice in the first place.

#### Knock on drag-down of healthy Troves below MCR

The impact of redistributions on the remaining active Troves is that they see their ICRs reduced. It’s possible that this ICR reduction causes them to fall below the MCR and thus also become liquidateable - however this knock-on “drag-down” effect can occur as a result of either batch or sequential liquidations, is a known dynamic of the system, and was also present in Liquity v1.

Past simulation has shown that this potential knock-on drag-down effect is minor, though does depend on the system state - i.e. the distribution of ICRs and collateral sizes.

### 18 - TODOs in code comments

A number of TODOs remain in comments in core smart contracts:

- TroveManager L1276: https://github.com/liquity/bold/blob/6a793b24b294f6f1581746e021bcd6845fc3dc06/contracts/src/TroveManager.sol#L1276  This `assert` always holds true since the encapsulating function is only called when a Trove is opened.

- StabilityPool L372: https://github.com/liquity/bold/blob/6a793b24b294f6f1581746e021bcd6845fc3dc06/contracts/src/StabilityPool.sol#L372  This `assert` is always true since the encapsulating function triggerBoldRewards is only ever called when there is non-zero BOLD yield for the SP - see ActivePool L258: https://github.com/liquity/bold/blob/6a793b24b294f6f1581746e021bcd6845fc3dc06/contracts/src/ActivePool.sol#L258.

- MainnetPriceFeedBase L52: https://github.com/liquity/bold/blob/6a793b24b294f6f1581746e021bcd6845fc3dc06/contracts/src/PriceFeeds/MainnetPriceFeedBase.sol#L52  This is irrelevant now that contracts have been deployed.

### Issues identified in audits requiring no fix
A collection of issues identified in security audits which nevertheless do not require a fix [can be found here](https://github.com/liquity/bold/labels/wontfix).
