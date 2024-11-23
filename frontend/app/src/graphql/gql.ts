/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
const documents = {
    "\n  query TotalDeposited {\n    collaterals {\n      collIndex\n      totalDeposited\n    }\n  }\n": types.TotalDepositedDocument,
    "\n  query TrovesCount($id: ID!) {\n    borrowerInfo(id: $id) {\n      troves\n      trovesByCollateral\n    }\n  }\n": types.TrovesCountDocument,
    "\n  fragment FullTroveFragment on Trove {\n    id\n    borrower\n    closedAt\n    createdAt\n    debt\n    deposit\n    interestRate\n    mightBeLeveraged\n    stake\n    status\n    troveId\n    updatedAt\n    collateral {\n      id\n      token {\n        symbol\n        name\n      }\n      minCollRatio\n      collIndex\n    }\n    interestBatch {\n      id\n      annualInterestRate\n      annualManagementFee\n      batchManager\n    }\n  }\n": types.FullTroveFragmentFragmentDoc,
    "\n  query TrovesByAccount($account: Bytes!) {\n    troves(\n      where: {\n        borrower: $account,\n        status_in: [active,redeemed,liquidated],\n      }\n      orderBy: updatedAt\n      orderDirection: desc\n    ) {\n      ...FullTroveFragment\n    }\n  }\n": types.TrovesByAccountDocument,
    "\n  query TroveById($id: ID!) {\n    trove(id: $id) {\n      ...FullTroveFragment\n    }\n  }\n": types.TroveByIdDocument,
    "\n  query StabilityPool($id: ID!) {\n    stabilityPool(id: $id) {\n      id\n      totalDeposited\n    }\n  }\n": types.StabilityPoolDocument,
    "\n  fragment StabilityPoolDepositFragment on StabilityPoolDeposit {\n    id\n    deposit\n    depositor\n    collateral {\n      collIndex\n    }\n    snapshot {\n      B\n      P\n      S\n      epoch\n      scale\n    }\n  }\n": types.StabilityPoolDepositFragmentFragmentDoc,
    "\n  query StabilityPoolDepositsByAccount($account: Bytes!) {\n    stabilityPoolDeposits(where: { depositor: $account, deposit_gt: 0 }) {\n      ...StabilityPoolDepositFragment\n    }\n  }\n": types.StabilityPoolDepositsByAccountDocument,
    "\n  query StabilityPoolDeposit($id: ID!) {\n    stabilityPoolDeposit(id: $id) {\n      ...StabilityPoolDepositFragment\n    }\n  }\n": types.StabilityPoolDepositDocument,
    "\n  query StabilityPoolEpochScale($id: ID!) {\n    stabilityPoolEpochScale(id: $id) {\n      id\n      B\n      S\n    }\n  }\n": types.StabilityPoolEpochScaleDocument,
    "\n  query InterestBatch($id: ID!) {\n    interestBatch(id: $id) {\n      collateral {\n        collIndex\n      }\n      batchManager\n      debt\n      coll\n      annualInterestRate\n      annualManagementFee\n    }\n  }\n": types.InterestBatchDocument,
    "\n  query InterestRateBrackets($collId: String!) {\n    interestRateBrackets(where: { collateral: $collId }, orderBy: rate) {\n      rate\n      totalDebt\n    }\n  }\n": types.InterestRateBracketsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TotalDeposited {\n    collaterals {\n      collIndex\n      totalDeposited\n    }\n  }\n"): typeof import('./graphql').TotalDepositedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TrovesCount($id: ID!) {\n    borrowerInfo(id: $id) {\n      troves\n      trovesByCollateral\n    }\n  }\n"): typeof import('./graphql').TrovesCountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment FullTroveFragment on Trove {\n    id\n    borrower\n    closedAt\n    createdAt\n    debt\n    deposit\n    interestRate\n    mightBeLeveraged\n    stake\n    status\n    troveId\n    updatedAt\n    collateral {\n      id\n      token {\n        symbol\n        name\n      }\n      minCollRatio\n      collIndex\n    }\n    interestBatch {\n      id\n      annualInterestRate\n      annualManagementFee\n      batchManager\n    }\n  }\n"): typeof import('./graphql').FullTroveFragmentFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TrovesByAccount($account: Bytes!) {\n    troves(\n      where: {\n        borrower: $account,\n        status_in: [active,redeemed,liquidated],\n      }\n      orderBy: updatedAt\n      orderDirection: desc\n    ) {\n      ...FullTroveFragment\n    }\n  }\n"): typeof import('./graphql').TrovesByAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TroveById($id: ID!) {\n    trove(id: $id) {\n      ...FullTroveFragment\n    }\n  }\n"): typeof import('./graphql').TroveByIdDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StabilityPool($id: ID!) {\n    stabilityPool(id: $id) {\n      id\n      totalDeposited\n    }\n  }\n"): typeof import('./graphql').StabilityPoolDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment StabilityPoolDepositFragment on StabilityPoolDeposit {\n    id\n    deposit\n    depositor\n    collateral {\n      collIndex\n    }\n    snapshot {\n      B\n      P\n      S\n      epoch\n      scale\n    }\n  }\n"): typeof import('./graphql').StabilityPoolDepositFragmentFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StabilityPoolDepositsByAccount($account: Bytes!) {\n    stabilityPoolDeposits(where: { depositor: $account, deposit_gt: 0 }) {\n      ...StabilityPoolDepositFragment\n    }\n  }\n"): typeof import('./graphql').StabilityPoolDepositsByAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StabilityPoolDeposit($id: ID!) {\n    stabilityPoolDeposit(id: $id) {\n      ...StabilityPoolDepositFragment\n    }\n  }\n"): typeof import('./graphql').StabilityPoolDepositDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StabilityPoolEpochScale($id: ID!) {\n    stabilityPoolEpochScale(id: $id) {\n      id\n      B\n      S\n    }\n  }\n"): typeof import('./graphql').StabilityPoolEpochScaleDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query InterestBatch($id: ID!) {\n    interestBatch(id: $id) {\n      collateral {\n        collIndex\n      }\n      batchManager\n      debt\n      coll\n      annualInterestRate\n      annualManagementFee\n    }\n  }\n"): typeof import('./graphql').InterestBatchDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query InterestRateBrackets($collId: String!) {\n    interestRateBrackets(where: { collateral: $collId }, orderBy: rate) {\n      rate\n      totalDebt\n    }\n  }\n"): typeof import('./graphql').InterestRateBracketsDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
