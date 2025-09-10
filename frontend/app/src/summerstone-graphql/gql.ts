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
    "\n  query BatchManagers($collateralIn: [String!], $batchManagerIn: [String!]) {\n    batchManagers(collateralBranchIdIn: $collateralIn, batchManagerIn: $batchManagerIn) {\n      collateralBranchId\n      batchManagerId\n      targetInterestRate\n      currentInterestRate\n      timeSinceLastAdjustment\n      daysToAdjustment\n      annualManagementFee\n      status\n      metadata {\n        name\n        description\n        supersededBy\n        riskHint\n        link\n        collateralToken {\n          name\n          symbol\n          decimals\n          address\n        }\n      }\n    }\n  }\n": typeof types.BatchManagersDocument,
};
const documents: Documents = {
    "\n  query BatchManagers($collateralIn: [String!], $batchManagerIn: [String!]) {\n    batchManagers(collateralBranchIdIn: $collateralIn, batchManagerIn: $batchManagerIn) {\n      collateralBranchId\n      batchManagerId\n      targetInterestRate\n      currentInterestRate\n      timeSinceLastAdjustment\n      daysToAdjustment\n      annualManagementFee\n      status\n      metadata {\n        name\n        description\n        supersededBy\n        riskHint\n        link\n        collateralToken {\n          name\n          symbol\n          decimals\n          address\n        }\n      }\n    }\n  }\n": types.BatchManagersDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BatchManagers($collateralIn: [String!], $batchManagerIn: [String!]) {\n    batchManagers(collateralBranchIdIn: $collateralIn, batchManagerIn: $batchManagerIn) {\n      collateralBranchId\n      batchManagerId\n      targetInterestRate\n      currentInterestRate\n      timeSinceLastAdjustment\n      daysToAdjustment\n      annualManagementFee\n      status\n      metadata {\n        name\n        description\n        supersededBy\n        riskHint\n        link\n        collateralToken {\n          name\n          symbol\n          decimals\n          address\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').BatchManagersDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
