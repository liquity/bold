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
type Documents = {
    "\n  query BlockNumber {\n    _meta {\n      block {\n        number\n      }\n    }\n  }\n": typeof types.BlockNumberDocument,
    "\n  query NextOwnerIndexesByBorrower($id: ID!) {\n    borrowerInfo(id: $id) {\n      nextOwnerIndexes\n    }\n  }\n": typeof types.NextOwnerIndexesByBorrowerDocument,
    "\n  query TrovesByAccount($account: Bytes!) {\n    troves(\n      where: {\n        or: [\n          { previousOwner: $account, status: liquidated },\n          { borrower: $account, status_in: [active,redeemed] }\n        ],\n      }\n      orderBy: updatedAt\n      orderDirection: desc\n    ) {\n      id\n      closedAt\n      createdAt\n      mightBeLeveraged\n      status\n    }\n  }\n": typeof types.TrovesByAccountDocument,
    "\n  query TroveById($id: ID!) {\n    trove(id: $id) {\n      id\n      borrower\n      closedAt\n      createdAt\n      mightBeLeveraged\n      previousOwner\n      status\n    }\n  }\n": typeof types.TroveByIdDocument,
    "\n  query InterestBatches($ids: [ID!]!) {\n    interestBatches(where: { id_in: $ids }) {\n      collateral {\n        collIndex\n      }\n      batchManager\n      debt\n      coll\n      annualInterestRate\n      annualManagementFee\n    }\n  }\n": typeof types.InterestBatchesDocument,
    "\n  query AllInterestRateBrackets {\n    interestRateBrackets(\n      first: 1000\n      where: { totalDebt_gt: 0 }\n      orderBy: rate\n    ) {\n      collateral {\n        collIndex\n      }\n      rate\n      totalDebt\n    }\n  }\n": typeof types.AllInterestRateBracketsDocument,
    "\n  query GovernanceInitiatives {\n    governanceInitiatives {\n      id\n    }\n  }\n": typeof types.GovernanceInitiativesDocument,
    "\n  query AllocationHistory($user: String $initiative: String) {\n    userAllocations: governanceAllocations(\n      where: {\n        initiative: $initiative\n        user: $user\n      }\n      orderBy: epoch\n      orderDirection: desc\n    ) {\n      epoch\n      voteLQTY\n      vetoLQTY\n      voteOffset\n      vetoOffset\n    }\n\n    totalAllocations: governanceAllocations(\n      where: {\n        initiative: $initiative\n        user: null\n      }\n      orderBy: epoch\n      orderDirection: desc\n    ) {\n      epoch\n      voteLQTY\n      vetoLQTY\n      voteOffset\n      vetoOffset\n    }\n  }\n": typeof types.AllocationHistoryDocument,
};
const documents: Documents = {
    "\n  query BlockNumber {\n    _meta {\n      block {\n        number\n      }\n    }\n  }\n": types.BlockNumberDocument,
    "\n  query NextOwnerIndexesByBorrower($id: ID!) {\n    borrowerInfo(id: $id) {\n      nextOwnerIndexes\n    }\n  }\n": types.NextOwnerIndexesByBorrowerDocument,
    "\n  query TrovesByAccount($account: Bytes!) {\n    troves(\n      where: {\n        or: [\n          { previousOwner: $account, status: liquidated },\n          { borrower: $account, status_in: [active,redeemed] }\n        ],\n      }\n      orderBy: updatedAt\n      orderDirection: desc\n    ) {\n      id\n      closedAt\n      createdAt\n      mightBeLeveraged\n      status\n    }\n  }\n": types.TrovesByAccountDocument,
    "\n  query TroveById($id: ID!) {\n    trove(id: $id) {\n      id\n      borrower\n      closedAt\n      createdAt\n      mightBeLeveraged\n      previousOwner\n      status\n    }\n  }\n": types.TroveByIdDocument,
    "\n  query InterestBatches($ids: [ID!]!) {\n    interestBatches(where: { id_in: $ids }) {\n      collateral {\n        collIndex\n      }\n      batchManager\n      debt\n      coll\n      annualInterestRate\n      annualManagementFee\n    }\n  }\n": types.InterestBatchesDocument,
    "\n  query AllInterestRateBrackets {\n    interestRateBrackets(\n      first: 1000\n      where: { totalDebt_gt: 0 }\n      orderBy: rate\n    ) {\n      collateral {\n        collIndex\n      }\n      rate\n      totalDebt\n    }\n  }\n": types.AllInterestRateBracketsDocument,
    "\n  query GovernanceInitiatives {\n    governanceInitiatives {\n      id\n    }\n  }\n": types.GovernanceInitiativesDocument,
    "\n  query AllocationHistory($user: String $initiative: String) {\n    userAllocations: governanceAllocations(\n      where: {\n        initiative: $initiative\n        user: $user\n      }\n      orderBy: epoch\n      orderDirection: desc\n    ) {\n      epoch\n      voteLQTY\n      vetoLQTY\n      voteOffset\n      vetoOffset\n    }\n\n    totalAllocations: governanceAllocations(\n      where: {\n        initiative: $initiative\n        user: null\n      }\n      orderBy: epoch\n      orderDirection: desc\n    ) {\n      epoch\n      voteLQTY\n      vetoLQTY\n      voteOffset\n      vetoOffset\n    }\n  }\n": types.AllocationHistoryDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BlockNumber {\n    _meta {\n      block {\n        number\n      }\n    }\n  }\n"): typeof import('./graphql').BlockNumberDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NextOwnerIndexesByBorrower($id: ID!) {\n    borrowerInfo(id: $id) {\n      nextOwnerIndexes\n    }\n  }\n"): typeof import('./graphql').NextOwnerIndexesByBorrowerDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TrovesByAccount($account: Bytes!) {\n    troves(\n      where: {\n        or: [\n          { previousOwner: $account, status: liquidated },\n          { borrower: $account, status_in: [active,redeemed] }\n        ],\n      }\n      orderBy: updatedAt\n      orderDirection: desc\n    ) {\n      id\n      closedAt\n      createdAt\n      mightBeLeveraged\n      status\n    }\n  }\n"): typeof import('./graphql').TrovesByAccountDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query TroveById($id: ID!) {\n    trove(id: $id) {\n      id\n      borrower\n      closedAt\n      createdAt\n      mightBeLeveraged\n      previousOwner\n      status\n    }\n  }\n"): typeof import('./graphql').TroveByIdDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query InterestBatches($ids: [ID!]!) {\n    interestBatches(where: { id_in: $ids }) {\n      collateral {\n        collIndex\n      }\n      batchManager\n      debt\n      coll\n      annualInterestRate\n      annualManagementFee\n    }\n  }\n"): typeof import('./graphql').InterestBatchesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AllInterestRateBrackets {\n    interestRateBrackets(\n      first: 1000\n      where: { totalDebt_gt: 0 }\n      orderBy: rate\n    ) {\n      collateral {\n        collIndex\n      }\n      rate\n      totalDebt\n    }\n  }\n"): typeof import('./graphql').AllInterestRateBracketsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GovernanceInitiatives {\n    governanceInitiatives {\n      id\n    }\n  }\n"): typeof import('./graphql').GovernanceInitiativesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AllocationHistory($user: String $initiative: String) {\n    userAllocations: governanceAllocations(\n      where: {\n        initiative: $initiative\n        user: $user\n      }\n      orderBy: epoch\n      orderDirection: desc\n    ) {\n      epoch\n      voteLQTY\n      vetoLQTY\n      voteOffset\n      vetoOffset\n    }\n\n    totalAllocations: governanceAllocations(\n      where: {\n        initiative: $initiative\n        user: null\n      }\n      orderBy: epoch\n      orderDirection: desc\n    ) {\n      epoch\n      voteLQTY\n      vetoLQTY\n      voteOffset\n      vetoOffset\n    }\n  }\n"): typeof import('./graphql').AllocationHistoryDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
