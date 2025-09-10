/* eslint-disable */
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

/**
 * Represents the current status of a batch manager's interest rate adjustment process.
 *
 * This type provides a public view of batch manager status suitable for API consumers,
 * aggregating information about current and target interest rates, adjustment timelines,
 * and operational status.
 */
export type BatchManager = {
  __typename?: 'BatchManager';
  /** The annual management fee charged by this batch manager as a raw u64 value from the original U256 */
  annualManagementFee: Scalars['Int']['output'];
  /** The batch manager's blockchain address in hex string format */
  batchManagerId: Scalars['String']['output'];
  /** The collateral branch identifier */
  collateralBranchId: Scalars['String']['output'];
  /** Current interest rate as raw u64 value from the original U256 */
  currentInterestRate: Scalars['Int']['output'];
  /**
   * Approximate time until next adjustment in days.
   * Returns `null` if no adjustment is currently planned.
   */
  daysToAdjustment?: Maybe<Scalars['Int']['output']>;
  /** Additional descriptive information about the batch manager */
  metadata: BatchManagerMetadata;
  /**
   * The current operational status of the batch manager.
   * See the `PublicStatus` enum for possible values and their meanings.
   */
  status: PublicStatus;
  /** Target interest rate as raw u64 value from the original U256 */
  targetInterestRate: Scalars['Int']['output'];
  /** Time since last adjustment in seconds */
  timeSinceLastAdjustment: Scalars['Int']['output'];
};

/**
 * Descriptive metadata for a batch manager.
 *
 * Contains human-readable information and configuration details about a batch manager,
 * including its name, description, risk profile, and operational status.
 */
export type BatchManagerMetadata = {
  __typename?: 'BatchManagerMetadata';
  /** The token metadata for the collateral branch */
  collateralToken: TokenMetadata;
  /** Detailed description of the batch manager's purpose and strategy */
  description: Scalars['String']['output'];
  /**
   * Optional URL with additional information about this batch manager.
   * May link to documentation, dashboards, or related resources.
   */
  link?: Maybe<Scalars['String']['output']>;
  /** Display name of the batch manager (e.g., "ETH Conservative") */
  name: Scalars['String']['output'];
  /**
   * A UI display hint value from 0.0 (conservative) to 1.0 (aggressive) for positioning
   * this batch manager on a slider in the user interface.
   * This is purely for display purposes and should not be considered any real measure of risk.
   * It only suggests the relative position of this manager compared to others in the UI.
   * Optional field - if not provided, no positioning hint is available.
   */
  riskHint?: Maybe<Scalars['Float']['output']>;
  /**
   * If this batch manager has been replaced, contains the address of the new manager.
   * Represented as an H160 hex string. `null` if not superseded.
   */
  supersededBy?: Maybe<Scalars['String']['output']>;
};

/**
 * Represents the public operational status of a batch manager.
 *
 * This enum provides a user-friendly view of a batch manager's current status,
 * abstracting away the more complex internal state machine.
 */
export enum PublicStatus {
  /**
   * An adjustment to the interest rate is scheduled to occur.
   * Check the `days_to_adjustment` field to see when it will happen.
   */
  ChangePlanned = 'CHANGE_PLANNED',
  /**
   * The batch manager has been replaced by a newer version.
   * Check the `superseded_by` field in metadata to find the replacement.
   */
  Deprecated = 'DEPRECATED',
  /**
   * The batch manager is currently not actively managing interest rates.
   * This could be temporary (maintenance) or permanent.
   */
  Inactive = 'INACTIVE',
  /**
   * The current interest rate is close enough to the target that
   * no adjustment is necessary.
   */
  InRange = 'IN_RANGE'
}

export type QueryRoot = {
  __typename?: 'QueryRoot';
  /**
   * Retrieves detailed status information for a specific batch manager and collateral combination.
   *
   * This query is useful when you want to monitor a particular batch manager's status,
   * including its current and target interest rates, adjustment timelines, and operational status.
   *
   * # Arguments
   * * `collateral_branch_id_in` - The ID of the collateral
   * * `batch_manager_id` - The ID of the batch manager as a hex string
   *
   * # Returns
   * * `BatchManager` - Detailed status information if the batch manager exists
   * * `null` - If the batch manager doesn't exist for the specified collateral
   */
  batchManager?: Maybe<BatchManager>;
  /**
   * Retrieves status information for multiple batch managers with optional filtering.
   *
   * This query allows monitoring of batch managers across different collaterals,
   * including their current and target interest rates, adjustment timelines, and
   * operational status. Results can be filtered by collateral ID and/or batch manager ID.
   *
   * # Arguments
   * * `collateral_branch_id_in` - Optional list of collateral IDs to filter by (e.g., ["0", "1"])
   * * `batch_manager_in` - Optional list of batch manager IDs (as hex strings) to filter by
   *
   * # Returns
   * Array of `BatchManager` objects for matching batch managers
   */
  batchManagers: Array<BatchManager>;
};


export type QueryRootBatchManagerArgs = {
  batchManagerId: Scalars['String']['input'];
  collateralBranchIdIn: Scalars['String']['input'];
};


export type QueryRootBatchManagersArgs = {
  batchManagerIn?: InputMaybe<Array<Scalars['String']['input']>>;
  collateralBranchIdIn?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TokenMetadata = {
  __typename?: 'TokenMetadata';
  address: Scalars['String']['output'];
  decimals: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
};

export type BatchManagersQueryVariables = Exact<{
  collateralIn?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  batchManagerIn?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type BatchManagersQuery = { __typename?: 'QueryRoot', batchManagers: Array<{ __typename?: 'BatchManager', collateralBranchId: string, batchManagerId: string, targetInterestRate: number, currentInterestRate: number, timeSinceLastAdjustment: number, daysToAdjustment?: number | null, annualManagementFee: number, status: PublicStatus, metadata: { __typename?: 'BatchManagerMetadata', name: string, description: string, supersededBy?: string | null, riskHint?: number | null, link?: string | null, collateralToken: { __typename?: 'TokenMetadata', name: string, symbol: string, decimals: number, address: string } } }> };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const BatchManagersDocument = new TypedDocumentString(`
    query BatchManagers($collateralIn: [String!], $batchManagerIn: [String!]) {
  batchManagers(
    collateralBranchIdIn: $collateralIn
    batchManagerIn: $batchManagerIn
  ) {
    collateralBranchId
    batchManagerId
    targetInterestRate
    currentInterestRate
    timeSinceLastAdjustment
    daysToAdjustment
    annualManagementFee
    status
    metadata {
      name
      description
      supersededBy
      riskHint
      link
      collateralToken {
        name
        symbol
        decimals
        address
      }
    }
  }
}
    `) as unknown as TypedDocumentString<BatchManagersQuery, BatchManagersQueryVariables>;