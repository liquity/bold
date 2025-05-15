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
  BigDecimal: { input: string; output: string; }
  BigInt: { input: bigint; output: bigint; }
  Bytes: { input: string; output: string; }
  /**
   * 8 bytes signed integer
   *
   */
  Int8: { input: number; output: number; }
  /**
   * A string representation of microseconds UNIX timestamp (16 digits)
   *
   */
  Timestamp: { input: string; output: string; }
};

export enum Aggregation_Interval {
  Day = 'day',
  Hour = 'hour'
}

export type BlockChangedFilter = {
  number_gte: Scalars['Int']['input'];
};

export type Block_Height = {
  hash?: InputMaybe<Scalars['Bytes']['input']>;
  number?: InputMaybe<Scalars['Int']['input']>;
  number_gte?: InputMaybe<Scalars['Int']['input']>;
};

export type BorrowerInfo = {
  __typename?: 'BorrowerInfo';
  id: Scalars['ID']['output'];
  nextOwnerIndexes: Array<Scalars['Int']['output']>;
  troves: Scalars['Int']['output'];
  trovesByCollateral: Array<Scalars['Int']['output']>;
};

export type BorrowerInfo_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<BorrowerInfo_Filter>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  nextOwnerIndexes?: InputMaybe<Array<Scalars['Int']['input']>>;
  nextOwnerIndexes_contains?: InputMaybe<Array<Scalars['Int']['input']>>;
  nextOwnerIndexes_contains_nocase?: InputMaybe<Array<Scalars['Int']['input']>>;
  nextOwnerIndexes_not?: InputMaybe<Array<Scalars['Int']['input']>>;
  nextOwnerIndexes_not_contains?: InputMaybe<Array<Scalars['Int']['input']>>;
  nextOwnerIndexes_not_contains_nocase?: InputMaybe<Array<Scalars['Int']['input']>>;
  or?: InputMaybe<Array<InputMaybe<BorrowerInfo_Filter>>>;
  troves?: InputMaybe<Scalars['Int']['input']>;
  trovesByCollateral?: InputMaybe<Array<Scalars['Int']['input']>>;
  trovesByCollateral_contains?: InputMaybe<Array<Scalars['Int']['input']>>;
  trovesByCollateral_contains_nocase?: InputMaybe<Array<Scalars['Int']['input']>>;
  trovesByCollateral_not?: InputMaybe<Array<Scalars['Int']['input']>>;
  trovesByCollateral_not_contains?: InputMaybe<Array<Scalars['Int']['input']>>;
  trovesByCollateral_not_contains_nocase?: InputMaybe<Array<Scalars['Int']['input']>>;
  troves_gt?: InputMaybe<Scalars['Int']['input']>;
  troves_gte?: InputMaybe<Scalars['Int']['input']>;
  troves_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  troves_lt?: InputMaybe<Scalars['Int']['input']>;
  troves_lte?: InputMaybe<Scalars['Int']['input']>;
  troves_not?: InputMaybe<Scalars['Int']['input']>;
  troves_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export enum BorrowerInfo_OrderBy {
  Id = 'id',
  NextOwnerIndexes = 'nextOwnerIndexes',
  Troves = 'troves',
  TrovesByCollateral = 'trovesByCollateral'
}

export type Collateral = {
  __typename?: 'Collateral';
  addresses: CollateralAddresses;
  collIndex: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  minCollRatio: Scalars['BigInt']['output'];
  troves: Array<Trove>;
};


export type CollateralTrovesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Trove_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Trove_Filter>;
};

export type CollateralAddresses = {
  __typename?: 'CollateralAddresses';
  borrowerOperations: Scalars['Bytes']['output'];
  collateral: Collateral;
  id: Scalars['ID']['output'];
  sortedTroves: Scalars['Bytes']['output'];
  stabilityPool: Scalars['Bytes']['output'];
  token: Scalars['Bytes']['output'];
  troveManager: Scalars['Bytes']['output'];
  troveNft: Scalars['Bytes']['output'];
};

export type CollateralAddresses_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<CollateralAddresses_Filter>>>;
  borrowerOperations?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_contains?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_gt?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_gte?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  borrowerOperations_lt?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_lte?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_not?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  borrowerOperations_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  collateral?: InputMaybe<Scalars['String']['input']>;
  collateral_?: InputMaybe<Collateral_Filter>;
  collateral_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_gt?: InputMaybe<Scalars['String']['input']>;
  collateral_gte?: InputMaybe<Scalars['String']['input']>;
  collateral_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_lt?: InputMaybe<Scalars['String']['input']>;
  collateral_lte?: InputMaybe<Scalars['String']['input']>;
  collateral_not?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<CollateralAddresses_Filter>>>;
  sortedTroves?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_contains?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_gt?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_gte?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  sortedTroves_lt?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_lte?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_not?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  sortedTroves_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  stabilityPool?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_contains?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_gt?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_gte?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  stabilityPool_lt?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_lte?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_not?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  stabilityPool_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  token?: InputMaybe<Scalars['Bytes']['input']>;
  token_contains?: InputMaybe<Scalars['Bytes']['input']>;
  token_gt?: InputMaybe<Scalars['Bytes']['input']>;
  token_gte?: InputMaybe<Scalars['Bytes']['input']>;
  token_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  token_lt?: InputMaybe<Scalars['Bytes']['input']>;
  token_lte?: InputMaybe<Scalars['Bytes']['input']>;
  token_not?: InputMaybe<Scalars['Bytes']['input']>;
  token_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  token_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  troveManager?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_contains?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_gt?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_gte?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  troveManager_lt?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_lte?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_not?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  troveManager_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  troveNft?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_contains?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_gt?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_gte?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  troveNft_lt?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_lte?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_not?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  troveNft_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
};

export enum CollateralAddresses_OrderBy {
  BorrowerOperations = 'borrowerOperations',
  Collateral = 'collateral',
  CollateralCollIndex = 'collateral__collIndex',
  CollateralId = 'collateral__id',
  CollateralMinCollRatio = 'collateral__minCollRatio',
  Id = 'id',
  SortedTroves = 'sortedTroves',
  StabilityPool = 'stabilityPool',
  Token = 'token',
  TroveManager = 'troveManager',
  TroveNft = 'troveNft'
}

export type Collateral_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  addresses_?: InputMaybe<CollateralAddresses_Filter>;
  and?: InputMaybe<Array<InputMaybe<Collateral_Filter>>>;
  collIndex?: InputMaybe<Scalars['Int']['input']>;
  collIndex_gt?: InputMaybe<Scalars['Int']['input']>;
  collIndex_gte?: InputMaybe<Scalars['Int']['input']>;
  collIndex_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  collIndex_lt?: InputMaybe<Scalars['Int']['input']>;
  collIndex_lte?: InputMaybe<Scalars['Int']['input']>;
  collIndex_not?: InputMaybe<Scalars['Int']['input']>;
  collIndex_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  minCollRatio?: InputMaybe<Scalars['BigInt']['input']>;
  minCollRatio_gt?: InputMaybe<Scalars['BigInt']['input']>;
  minCollRatio_gte?: InputMaybe<Scalars['BigInt']['input']>;
  minCollRatio_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  minCollRatio_lt?: InputMaybe<Scalars['BigInt']['input']>;
  minCollRatio_lte?: InputMaybe<Scalars['BigInt']['input']>;
  minCollRatio_not?: InputMaybe<Scalars['BigInt']['input']>;
  minCollRatio_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Collateral_Filter>>>;
  troves_?: InputMaybe<Trove_Filter>;
};

export enum Collateral_OrderBy {
  Addresses = 'addresses',
  AddressesBorrowerOperations = 'addresses__borrowerOperations',
  AddressesId = 'addresses__id',
  AddressesSortedTroves = 'addresses__sortedTroves',
  AddressesStabilityPool = 'addresses__stabilityPool',
  AddressesToken = 'addresses__token',
  AddressesTroveManager = 'addresses__troveManager',
  AddressesTroveNft = 'addresses__troveNft',
  CollIndex = 'collIndex',
  Id = 'id',
  MinCollRatio = 'minCollRatio',
  Troves = 'troves'
}

export type GovernanceAllocation = {
  __typename?: 'GovernanceAllocation';
  atEpoch: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  initiative: GovernanceInitiative;
  user: GovernanceUser;
  vetoLQTY: Scalars['BigInt']['output'];
  voteLQTY: Scalars['BigInt']['output'];
};

export type GovernanceAllocation_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<GovernanceAllocation_Filter>>>;
  atEpoch?: InputMaybe<Scalars['BigInt']['input']>;
  atEpoch_gt?: InputMaybe<Scalars['BigInt']['input']>;
  atEpoch_gte?: InputMaybe<Scalars['BigInt']['input']>;
  atEpoch_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  atEpoch_lt?: InputMaybe<Scalars['BigInt']['input']>;
  atEpoch_lte?: InputMaybe<Scalars['BigInt']['input']>;
  atEpoch_not?: InputMaybe<Scalars['BigInt']['input']>;
  atEpoch_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  initiative?: InputMaybe<Scalars['String']['input']>;
  initiative_?: InputMaybe<GovernanceInitiative_Filter>;
  initiative_contains?: InputMaybe<Scalars['String']['input']>;
  initiative_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  initiative_ends_with?: InputMaybe<Scalars['String']['input']>;
  initiative_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  initiative_gt?: InputMaybe<Scalars['String']['input']>;
  initiative_gte?: InputMaybe<Scalars['String']['input']>;
  initiative_in?: InputMaybe<Array<Scalars['String']['input']>>;
  initiative_lt?: InputMaybe<Scalars['String']['input']>;
  initiative_lte?: InputMaybe<Scalars['String']['input']>;
  initiative_not?: InputMaybe<Scalars['String']['input']>;
  initiative_not_contains?: InputMaybe<Scalars['String']['input']>;
  initiative_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  initiative_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  initiative_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  initiative_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  initiative_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  initiative_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  initiative_starts_with?: InputMaybe<Scalars['String']['input']>;
  initiative_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  or?: InputMaybe<Array<InputMaybe<GovernanceAllocation_Filter>>>;
  user?: InputMaybe<Scalars['String']['input']>;
  user_?: InputMaybe<GovernanceUser_Filter>;
  user_contains?: InputMaybe<Scalars['String']['input']>;
  user_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_ends_with?: InputMaybe<Scalars['String']['input']>;
  user_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_gt?: InputMaybe<Scalars['String']['input']>;
  user_gte?: InputMaybe<Scalars['String']['input']>;
  user_in?: InputMaybe<Array<Scalars['String']['input']>>;
  user_lt?: InputMaybe<Scalars['String']['input']>;
  user_lte?: InputMaybe<Scalars['String']['input']>;
  user_not?: InputMaybe<Scalars['String']['input']>;
  user_not_contains?: InputMaybe<Scalars['String']['input']>;
  user_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  user_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  user_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_starts_with?: InputMaybe<Scalars['String']['input']>;
  user_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  vetoLQTY?: InputMaybe<Scalars['BigInt']['input']>;
  vetoLQTY_gt?: InputMaybe<Scalars['BigInt']['input']>;
  vetoLQTY_gte?: InputMaybe<Scalars['BigInt']['input']>;
  vetoLQTY_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  vetoLQTY_lt?: InputMaybe<Scalars['BigInt']['input']>;
  vetoLQTY_lte?: InputMaybe<Scalars['BigInt']['input']>;
  vetoLQTY_not?: InputMaybe<Scalars['BigInt']['input']>;
  vetoLQTY_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  voteLQTY?: InputMaybe<Scalars['BigInt']['input']>;
  voteLQTY_gt?: InputMaybe<Scalars['BigInt']['input']>;
  voteLQTY_gte?: InputMaybe<Scalars['BigInt']['input']>;
  voteLQTY_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  voteLQTY_lt?: InputMaybe<Scalars['BigInt']['input']>;
  voteLQTY_lte?: InputMaybe<Scalars['BigInt']['input']>;
  voteLQTY_not?: InputMaybe<Scalars['BigInt']['input']>;
  voteLQTY_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum GovernanceAllocation_OrderBy {
  AtEpoch = 'atEpoch',
  Id = 'id',
  Initiative = 'initiative',
  InitiativeId = 'initiative__id',
  User = 'user',
  UserAllocatedLqty = 'user__allocatedLQTY',
  UserId = 'user__id',
  UserStakedLqty = 'user__stakedLQTY',
  UserStakedOffset = 'user__stakedOffset',
  VetoLqty = 'vetoLQTY',
  VoteLqty = 'voteLQTY'
}

export type GovernanceInitiative = {
  __typename?: 'GovernanceInitiative';
  id: Scalars['ID']['output'];
};

export type GovernanceInitiative_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<GovernanceInitiative_Filter>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<GovernanceInitiative_Filter>>>;
};

export enum GovernanceInitiative_OrderBy {
  Id = 'id'
}

export type GovernanceUser = {
  __typename?: 'GovernanceUser';
  allocated: Array<Scalars['Bytes']['output']>;
  allocatedLQTY: Scalars['BigInt']['output'];
  allocations: Array<GovernanceAllocation>;
  id: Scalars['ID']['output'];
  stakedLQTY: Scalars['BigInt']['output'];
  stakedOffset: Scalars['BigInt']['output'];
};


export type GovernanceUserAllocationsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<GovernanceAllocation_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<GovernanceAllocation_Filter>;
};

export type GovernanceUser_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  allocated?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  allocatedLQTY?: InputMaybe<Scalars['BigInt']['input']>;
  allocatedLQTY_gt?: InputMaybe<Scalars['BigInt']['input']>;
  allocatedLQTY_gte?: InputMaybe<Scalars['BigInt']['input']>;
  allocatedLQTY_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  allocatedLQTY_lt?: InputMaybe<Scalars['BigInt']['input']>;
  allocatedLQTY_lte?: InputMaybe<Scalars['BigInt']['input']>;
  allocatedLQTY_not?: InputMaybe<Scalars['BigInt']['input']>;
  allocatedLQTY_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  allocated_contains?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  allocated_contains_nocase?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  allocated_not?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  allocated_not_contains?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  allocated_not_contains_nocase?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  allocations_?: InputMaybe<GovernanceAllocation_Filter>;
  and?: InputMaybe<Array<InputMaybe<GovernanceUser_Filter>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<GovernanceUser_Filter>>>;
  stakedLQTY?: InputMaybe<Scalars['BigInt']['input']>;
  stakedLQTY_gt?: InputMaybe<Scalars['BigInt']['input']>;
  stakedLQTY_gte?: InputMaybe<Scalars['BigInt']['input']>;
  stakedLQTY_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stakedLQTY_lt?: InputMaybe<Scalars['BigInt']['input']>;
  stakedLQTY_lte?: InputMaybe<Scalars['BigInt']['input']>;
  stakedLQTY_not?: InputMaybe<Scalars['BigInt']['input']>;
  stakedLQTY_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stakedOffset?: InputMaybe<Scalars['BigInt']['input']>;
  stakedOffset_gt?: InputMaybe<Scalars['BigInt']['input']>;
  stakedOffset_gte?: InputMaybe<Scalars['BigInt']['input']>;
  stakedOffset_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stakedOffset_lt?: InputMaybe<Scalars['BigInt']['input']>;
  stakedOffset_lte?: InputMaybe<Scalars['BigInt']['input']>;
  stakedOffset_not?: InputMaybe<Scalars['BigInt']['input']>;
  stakedOffset_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum GovernanceUser_OrderBy {
  Allocated = 'allocated',
  AllocatedLqty = 'allocatedLQTY',
  Allocations = 'allocations',
  Id = 'id',
  StakedLqty = 'stakedLQTY',
  StakedOffset = 'stakedOffset'
}

export type InterestBatch = {
  __typename?: 'InterestBatch';
  annualInterestRate: Scalars['BigInt']['output'];
  annualManagementFee: Scalars['BigInt']['output'];
  batchManager: Scalars['Bytes']['output'];
  coll: Scalars['BigInt']['output'];
  collateral: Collateral;
  debt: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  troves: Array<Trove>;
};


export type InterestBatchTrovesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Trove_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Trove_Filter>;
};

export type InterestBatch_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<InterestBatch_Filter>>>;
  annualInterestRate?: InputMaybe<Scalars['BigInt']['input']>;
  annualInterestRate_gt?: InputMaybe<Scalars['BigInt']['input']>;
  annualInterestRate_gte?: InputMaybe<Scalars['BigInt']['input']>;
  annualInterestRate_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  annualInterestRate_lt?: InputMaybe<Scalars['BigInt']['input']>;
  annualInterestRate_lte?: InputMaybe<Scalars['BigInt']['input']>;
  annualInterestRate_not?: InputMaybe<Scalars['BigInt']['input']>;
  annualInterestRate_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  annualManagementFee?: InputMaybe<Scalars['BigInt']['input']>;
  annualManagementFee_gt?: InputMaybe<Scalars['BigInt']['input']>;
  annualManagementFee_gte?: InputMaybe<Scalars['BigInt']['input']>;
  annualManagementFee_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  annualManagementFee_lt?: InputMaybe<Scalars['BigInt']['input']>;
  annualManagementFee_lte?: InputMaybe<Scalars['BigInt']['input']>;
  annualManagementFee_not?: InputMaybe<Scalars['BigInt']['input']>;
  annualManagementFee_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  batchManager?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_contains?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_gt?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_gte?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  batchManager_lt?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_lte?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_not?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  batchManager_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  coll?: InputMaybe<Scalars['BigInt']['input']>;
  coll_gt?: InputMaybe<Scalars['BigInt']['input']>;
  coll_gte?: InputMaybe<Scalars['BigInt']['input']>;
  coll_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  coll_lt?: InputMaybe<Scalars['BigInt']['input']>;
  coll_lte?: InputMaybe<Scalars['BigInt']['input']>;
  coll_not?: InputMaybe<Scalars['BigInt']['input']>;
  coll_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  collateral?: InputMaybe<Scalars['String']['input']>;
  collateral_?: InputMaybe<Collateral_Filter>;
  collateral_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_gt?: InputMaybe<Scalars['String']['input']>;
  collateral_gte?: InputMaybe<Scalars['String']['input']>;
  collateral_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_lt?: InputMaybe<Scalars['String']['input']>;
  collateral_lte?: InputMaybe<Scalars['String']['input']>;
  collateral_not?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  debt?: InputMaybe<Scalars['BigInt']['input']>;
  debt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  debt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  debt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  debt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  debt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  debt_not?: InputMaybe<Scalars['BigInt']['input']>;
  debt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<InterestBatch_Filter>>>;
  troves_?: InputMaybe<Trove_Filter>;
};

export enum InterestBatch_OrderBy {
  AnnualInterestRate = 'annualInterestRate',
  AnnualManagementFee = 'annualManagementFee',
  BatchManager = 'batchManager',
  Coll = 'coll',
  Collateral = 'collateral',
  CollateralCollIndex = 'collateral__collIndex',
  CollateralId = 'collateral__id',
  CollateralMinCollRatio = 'collateral__minCollRatio',
  Debt = 'debt',
  Id = 'id',
  Troves = 'troves'
}

export type InterestRateBracket = {
  __typename?: 'InterestRateBracket';
  collateral: Collateral;
  id: Scalars['ID']['output'];
  rate: Scalars['BigInt']['output'];
  totalDebt: Scalars['BigInt']['output'];
};

export type InterestRateBracket_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<InterestRateBracket_Filter>>>;
  collateral?: InputMaybe<Scalars['String']['input']>;
  collateral_?: InputMaybe<Collateral_Filter>;
  collateral_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_gt?: InputMaybe<Scalars['String']['input']>;
  collateral_gte?: InputMaybe<Scalars['String']['input']>;
  collateral_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_lt?: InputMaybe<Scalars['String']['input']>;
  collateral_lte?: InputMaybe<Scalars['String']['input']>;
  collateral_not?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<InterestRateBracket_Filter>>>;
  rate?: InputMaybe<Scalars['BigInt']['input']>;
  rate_gt?: InputMaybe<Scalars['BigInt']['input']>;
  rate_gte?: InputMaybe<Scalars['BigInt']['input']>;
  rate_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  rate_lt?: InputMaybe<Scalars['BigInt']['input']>;
  rate_lte?: InputMaybe<Scalars['BigInt']['input']>;
  rate_not?: InputMaybe<Scalars['BigInt']['input']>;
  rate_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalDebt?: InputMaybe<Scalars['BigInt']['input']>;
  totalDebt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalDebt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalDebt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalDebt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalDebt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalDebt_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalDebt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum InterestRateBracket_OrderBy {
  Collateral = 'collateral',
  CollateralCollIndex = 'collateral__collIndex',
  CollateralId = 'collateral__id',
  CollateralMinCollRatio = 'collateral__minCollRatio',
  Id = 'id',
  Rate = 'rate',
  TotalDebt = 'totalDebt'
}

/** Defines the order direction, either ascending or descending */
export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type Query = {
  __typename?: 'Query';
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  borrowerInfo?: Maybe<BorrowerInfo>;
  borrowerInfos: Array<BorrowerInfo>;
  collateral?: Maybe<Collateral>;
  collateralAddresses?: Maybe<CollateralAddresses>;
  collateralAddresses_collection: Array<CollateralAddresses>;
  collaterals: Array<Collateral>;
  governanceAllocation?: Maybe<GovernanceAllocation>;
  governanceAllocations: Array<GovernanceAllocation>;
  governanceInitiative?: Maybe<GovernanceInitiative>;
  governanceInitiatives: Array<GovernanceInitiative>;
  governanceUser?: Maybe<GovernanceUser>;
  governanceUsers: Array<GovernanceUser>;
  interestBatch?: Maybe<InterestBatch>;
  interestBatches: Array<InterestBatch>;
  interestRateBracket?: Maybe<InterestRateBracket>;
  interestRateBrackets: Array<InterestRateBracket>;
  trove?: Maybe<Trove>;
  troves: Array<Trove>;
};


export type Query_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type QueryBorrowerInfoArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryBorrowerInfosArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BorrowerInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<BorrowerInfo_Filter>;
};


export type QueryCollateralArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryCollateralAddressesArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryCollateralAddresses_CollectionArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CollateralAddresses_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<CollateralAddresses_Filter>;
};


export type QueryCollateralsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Collateral_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Collateral_Filter>;
};


export type QueryGovernanceAllocationArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryGovernanceAllocationsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<GovernanceAllocation_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<GovernanceAllocation_Filter>;
};


export type QueryGovernanceInitiativeArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryGovernanceInitiativesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<GovernanceInitiative_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<GovernanceInitiative_Filter>;
};


export type QueryGovernanceUserArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryGovernanceUsersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<GovernanceUser_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<GovernanceUser_Filter>;
};


export type QueryInterestBatchArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryInterestBatchesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<InterestBatch_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<InterestBatch_Filter>;
};


export type QueryInterestRateBracketArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryInterestRateBracketsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<InterestRateBracket_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<InterestRateBracket_Filter>;
};


export type QueryTroveArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryTrovesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Trove_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Trove_Filter>;
};

export type Trove = {
  __typename?: 'Trove';
  borrower: Scalars['Bytes']['output'];
  closedAt?: Maybe<Scalars['BigInt']['output']>;
  collateral: Collateral;
  createdAt: Scalars['BigInt']['output'];
  debt: Scalars['BigInt']['output'];
  deposit: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  interestBatch?: Maybe<InterestBatch>;
  interestRate: Scalars['BigInt']['output'];
  mightBeLeveraged: Scalars['Boolean']['output'];
  stake: Scalars['BigInt']['output'];
  status: TroveStatus;
  troveId: Scalars['String']['output'];
  updatedAt: Scalars['BigInt']['output'];
};

export enum TroveStatus {
  Active = 'active',
  Closed = 'closed',
  Liquidated = 'liquidated',
  Redeemed = 'redeemed'
}

export type Trove_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Trove_Filter>>>;
  borrower?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_contains?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_gt?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_gte?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  borrower_lt?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_lte?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_not?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  borrower_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  closedAt?: InputMaybe<Scalars['BigInt']['input']>;
  closedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  closedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  closedAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  closedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  closedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  closedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  closedAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  collateral?: InputMaybe<Scalars['String']['input']>;
  collateral_?: InputMaybe<Collateral_Filter>;
  collateral_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_gt?: InputMaybe<Scalars['String']['input']>;
  collateral_gte?: InputMaybe<Scalars['String']['input']>;
  collateral_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_lt?: InputMaybe<Scalars['String']['input']>;
  collateral_lte?: InputMaybe<Scalars['String']['input']>;
  collateral_not?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  debt?: InputMaybe<Scalars['BigInt']['input']>;
  debt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  debt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  debt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  debt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  debt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  debt_not?: InputMaybe<Scalars['BigInt']['input']>;
  debt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  deposit?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  deposit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_not?: InputMaybe<Scalars['BigInt']['input']>;
  deposit_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  interestBatch?: InputMaybe<Scalars['String']['input']>;
  interestBatch_?: InputMaybe<InterestBatch_Filter>;
  interestBatch_contains?: InputMaybe<Scalars['String']['input']>;
  interestBatch_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  interestBatch_ends_with?: InputMaybe<Scalars['String']['input']>;
  interestBatch_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  interestBatch_gt?: InputMaybe<Scalars['String']['input']>;
  interestBatch_gte?: InputMaybe<Scalars['String']['input']>;
  interestBatch_in?: InputMaybe<Array<Scalars['String']['input']>>;
  interestBatch_lt?: InputMaybe<Scalars['String']['input']>;
  interestBatch_lte?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not_contains?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  interestBatch_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  interestBatch_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  interestBatch_starts_with?: InputMaybe<Scalars['String']['input']>;
  interestBatch_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  interestRate?: InputMaybe<Scalars['BigInt']['input']>;
  interestRate_gt?: InputMaybe<Scalars['BigInt']['input']>;
  interestRate_gte?: InputMaybe<Scalars['BigInt']['input']>;
  interestRate_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  interestRate_lt?: InputMaybe<Scalars['BigInt']['input']>;
  interestRate_lte?: InputMaybe<Scalars['BigInt']['input']>;
  interestRate_not?: InputMaybe<Scalars['BigInt']['input']>;
  interestRate_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  mightBeLeveraged?: InputMaybe<Scalars['Boolean']['input']>;
  mightBeLeveraged_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  mightBeLeveraged_not?: InputMaybe<Scalars['Boolean']['input']>;
  mightBeLeveraged_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Trove_Filter>>>;
  stake?: InputMaybe<Scalars['BigInt']['input']>;
  stake_gt?: InputMaybe<Scalars['BigInt']['input']>;
  stake_gte?: InputMaybe<Scalars['BigInt']['input']>;
  stake_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stake_lt?: InputMaybe<Scalars['BigInt']['input']>;
  stake_lte?: InputMaybe<Scalars['BigInt']['input']>;
  stake_not?: InputMaybe<Scalars['BigInt']['input']>;
  stake_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  status?: InputMaybe<TroveStatus>;
  status_in?: InputMaybe<Array<TroveStatus>>;
  status_not?: InputMaybe<TroveStatus>;
  status_not_in?: InputMaybe<Array<TroveStatus>>;
  troveId?: InputMaybe<Scalars['String']['input']>;
  troveId_contains?: InputMaybe<Scalars['String']['input']>;
  troveId_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  troveId_ends_with?: InputMaybe<Scalars['String']['input']>;
  troveId_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  troveId_gt?: InputMaybe<Scalars['String']['input']>;
  troveId_gte?: InputMaybe<Scalars['String']['input']>;
  troveId_in?: InputMaybe<Array<Scalars['String']['input']>>;
  troveId_lt?: InputMaybe<Scalars['String']['input']>;
  troveId_lte?: InputMaybe<Scalars['String']['input']>;
  troveId_not?: InputMaybe<Scalars['String']['input']>;
  troveId_not_contains?: InputMaybe<Scalars['String']['input']>;
  troveId_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  troveId_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  troveId_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  troveId_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  troveId_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  troveId_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  troveId_starts_with?: InputMaybe<Scalars['String']['input']>;
  troveId_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  updatedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  updatedAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export enum Trove_OrderBy {
  Borrower = 'borrower',
  ClosedAt = 'closedAt',
  Collateral = 'collateral',
  CollateralCollIndex = 'collateral__collIndex',
  CollateralId = 'collateral__id',
  CollateralMinCollRatio = 'collateral__minCollRatio',
  CreatedAt = 'createdAt',
  Debt = 'debt',
  Deposit = 'deposit',
  Id = 'id',
  InterestBatch = 'interestBatch',
  InterestBatchAnnualInterestRate = 'interestBatch__annualInterestRate',
  InterestBatchAnnualManagementFee = 'interestBatch__annualManagementFee',
  InterestBatchBatchManager = 'interestBatch__batchManager',
  InterestBatchColl = 'interestBatch__coll',
  InterestBatchDebt = 'interestBatch__debt',
  InterestBatchId = 'interestBatch__id',
  InterestRate = 'interestRate',
  MightBeLeveraged = 'mightBeLeveraged',
  Stake = 'stake',
  Status = 'status',
  TroveId = 'troveId',
  UpdatedAt = 'updatedAt'
}

export type _Block_ = {
  __typename?: '_Block_';
  /** The hash of the block */
  hash?: Maybe<Scalars['Bytes']['output']>;
  /** The block number */
  number: Scalars['Int']['output'];
  /** The hash of the parent block */
  parentHash?: Maybe<Scalars['Bytes']['output']>;
  /** Integer representation of the timestamp stored in blocks for the chain */
  timestamp?: Maybe<Scalars['Int']['output']>;
};

/** The type for the top-level _meta field */
export type _Meta_ = {
  __typename?: '_Meta_';
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   *
   */
  block: _Block_;
  /** The deployment ID */
  deployment: Scalars['String']['output'];
  /** If `true`, the subgraph encountered indexing errors at some past block */
  hasIndexingErrors: Scalars['Boolean']['output'];
};

export enum _SubgraphErrorPolicy_ {
  /** Data will be returned even if the subgraph has indexing errors */
  Allow = 'allow',
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  Deny = 'deny'
}

export type BlockNumberQueryVariables = Exact<{ [key: string]: never; }>;


export type BlockNumberQuery = { __typename?: 'Query', _meta?: { __typename?: '_Meta_', block: { __typename?: '_Block_', number: number } } | null };

export type BorrowerInfoQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type BorrowerInfoQuery = { __typename?: 'Query', borrowerInfo?: { __typename?: 'BorrowerInfo', nextOwnerIndexes: Array<number> } | null };

export type TroveStatusesByAccountQueryVariables = Exact<{
  account: Scalars['Bytes']['input'];
}>;


export type TroveStatusesByAccountQuery = { __typename?: 'Query', troves: Array<{ __typename?: 'Trove', id: string, closedAt?: bigint | null, createdAt: bigint, mightBeLeveraged: boolean, status: TroveStatus }> };

export type TroveStatusByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TroveStatusByIdQuery = { __typename?: 'Query', trove?: { __typename?: 'Trove', id: string, closedAt?: bigint | null, createdAt: bigint, mightBeLeveraged: boolean, status: TroveStatus } | null };

export type InterestBatchesQueryVariables = Exact<{
  ids: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type InterestBatchesQuery = { __typename?: 'Query', interestBatches: Array<{ __typename?: 'InterestBatch', batchManager: string, debt: bigint, coll: bigint, annualInterestRate: bigint, annualManagementFee: bigint, collateral: { __typename?: 'Collateral', collIndex: number } }> };

export type AllInterestRateBracketsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllInterestRateBracketsQuery = { __typename?: 'Query', interestRateBrackets: Array<{ __typename?: 'InterestRateBracket', rate: bigint, totalDebt: bigint, collateral: { __typename?: 'Collateral', collIndex: number } }> };

export type GovernanceInitiativesQueryVariables = Exact<{ [key: string]: never; }>;


export type GovernanceInitiativesQuery = { __typename?: 'Query', governanceInitiatives: Array<{ __typename?: 'GovernanceInitiative', id: string }> };

export type GovernanceUserAllocationsQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GovernanceUserAllocationsQuery = { __typename?: 'Query', governanceUser?: { __typename?: 'GovernanceUser', allocated: Array<string> } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: DocumentTypeDecoration<TResult, TVariables>['__apiType'];
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const BlockNumberDocument = new TypedDocumentString(`
    query BlockNumber {
  _meta {
    block {
      number
    }
  }
}
    `) as unknown as TypedDocumentString<BlockNumberQuery, BlockNumberQueryVariables>;
export const BorrowerInfoDocument = new TypedDocumentString(`
    query BorrowerInfo($id: ID!) {
  borrowerInfo(id: $id) {
    nextOwnerIndexes
  }
}
    `) as unknown as TypedDocumentString<BorrowerInfoQuery, BorrowerInfoQueryVariables>;
export const TroveStatusesByAccountDocument = new TypedDocumentString(`
    query TroveStatusesByAccount($account: Bytes!) {
  troves(
    where: {borrower: $account, status_in: [active, redeemed, liquidated]}
    orderBy: updatedAt
    orderDirection: desc
  ) {
    id
    closedAt
    createdAt
    mightBeLeveraged
    status
  }
}
    `) as unknown as TypedDocumentString<TroveStatusesByAccountQuery, TroveStatusesByAccountQueryVariables>;
export const TroveStatusByIdDocument = new TypedDocumentString(`
    query TroveStatusById($id: ID!) {
  trove(id: $id) {
    id
    closedAt
    createdAt
    mightBeLeveraged
    status
  }
}
    `) as unknown as TypedDocumentString<TroveStatusByIdQuery, TroveStatusByIdQueryVariables>;
export const InterestBatchesDocument = new TypedDocumentString(`
    query InterestBatches($ids: [ID!]!) {
  interestBatches(where: {id_in: $ids}) {
    collateral {
      collIndex
    }
    batchManager
    debt
    coll
    annualInterestRate
    annualManagementFee
  }
}
    `) as unknown as TypedDocumentString<InterestBatchesQuery, InterestBatchesQueryVariables>;
export const AllInterestRateBracketsDocument = new TypedDocumentString(`
    query AllInterestRateBrackets {
  interestRateBrackets(orderBy: rate) {
    collateral {
      collIndex
    }
    rate
    totalDebt
  }
}
    `) as unknown as TypedDocumentString<AllInterestRateBracketsQuery, AllInterestRateBracketsQueryVariables>;
export const GovernanceInitiativesDocument = new TypedDocumentString(`
    query GovernanceInitiatives {
  governanceInitiatives {
    id
  }
}
    `) as unknown as TypedDocumentString<GovernanceInitiativesQuery, GovernanceInitiativesQueryVariables>;
export const GovernanceUserAllocationsDocument = new TypedDocumentString(`
    query GovernanceUserAllocations($id: ID!) {
  governanceUser(id: $id) {
    allocated
  }
}
    `) as unknown as TypedDocumentString<GovernanceUserAllocationsQuery, GovernanceUserAllocationsQueryVariables>;