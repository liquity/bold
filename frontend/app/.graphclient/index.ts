// @ts-nocheck
import { GraphQLResolveInfo, SelectionSetNode, FieldNode, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
import { gql } from '@graphql-mesh/utils';

import type { GetMeshOptions } from '@graphql-mesh/runtime';
import type { YamlConfig } from '@graphql-mesh/types';
import { PubSub } from '@graphql-mesh/utils';
import { DefaultLogger } from '@graphql-mesh/utils';
import MeshCache from "@graphql-mesh/cache-localforage";
import { fetch as fetchFn } from '@whatwg-node/fetch';

import { MeshResolvedSource } from '@graphql-mesh/runtime';
import { MeshTransform, MeshPlugin } from '@graphql-mesh/types';
import GraphqlHandler from "@graphql-mesh/graphql"
import BareMerger from "@graphql-mesh/merger-bare";
import { printWithCache } from '@graphql-mesh/utils';
import { usePersistedOperations } from '@graphql-yoga/plugin-persisted-operations';
import { createMeshHTTPHandler, MeshHTTPHandler } from '@graphql-mesh/http';
import { getMesh, ExecuteMeshFn, SubscribeMeshFn, MeshContext as BaseMeshContext, MeshInstance } from '@graphql-mesh/runtime';
import { MeshStore, FsStoreStorageAdapter } from '@graphql-mesh/store';
import { path as pathModule } from '@graphql-mesh/cross-helpers';
import { ImportFn } from '@graphql-mesh/types';
import type { Liquity2Types } from './sources/liquity2/types';
import * as importedModule$0 from "./sources/liquity2/introspectionSchema";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };



/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigDecimal: { input: bigint; output: bigint; }
  BigInt: { input: bigint; output: bigint; }
  Bytes: { input: string; output: string; }
  Int8: { input: number; output: number; }
  Timestamp: { input: string; output: string; }
};

export type Aggregation_interval =
  | 'hour'
  | 'day';

export type BlockChangedFilter = {
  readonly number_gte: Scalars['Int']['input'];
};

export type Block_height = {
  readonly hash?: InputMaybe<Scalars['Bytes']['input']>;
  readonly number?: InputMaybe<Scalars['Int']['input']>;
  readonly number_gte?: InputMaybe<Scalars['Int']['input']>;
};

export type BorrowerInfo = {
  readonly id: Scalars['ID']['output'];
  readonly troves: Scalars['Int']['output'];
  readonly trovesByCollateral: ReadonlyArray<Scalars['Int']['output']>;
};

export type BorrowerInfo_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly troves?: InputMaybe<Scalars['Int']['input']>;
  readonly troves_not?: InputMaybe<Scalars['Int']['input']>;
  readonly troves_gt?: InputMaybe<Scalars['Int']['input']>;
  readonly troves_lt?: InputMaybe<Scalars['Int']['input']>;
  readonly troves_gte?: InputMaybe<Scalars['Int']['input']>;
  readonly troves_lte?: InputMaybe<Scalars['Int']['input']>;
  readonly troves_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly troves_not_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly trovesByCollateral?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly trovesByCollateral_not?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly trovesByCollateral_contains?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly trovesByCollateral_contains_nocase?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly trovesByCollateral_not_contains?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly trovesByCollateral_not_contains_nocase?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<BorrowerInfo_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<BorrowerInfo_filter>>>;
};

export type BorrowerInfo_orderBy =
  | 'id'
  | 'troves'
  | 'trovesByCollateral';

export type Collateral = {
  readonly id: Scalars['ID']['output'];
  readonly collIndex: Scalars['Int']['output'];
  readonly token: Token;
  readonly minCollRatio: Scalars['BigInt']['output'];
  readonly troves: ReadonlyArray<Trove>;
  readonly addresses: CollateralAddresses;
  readonly stabilityPoolDeposits: ReadonlyArray<StabilityPoolDeposit>;
  readonly totalDeposited: Scalars['BigInt']['output'];
  readonly totalDebt: Scalars['BigInt']['output'];
  readonly price: Scalars['BigInt']['output'];
};


export type CollateraltrovesArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Trove_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Trove_filter>;
};


export type CollateralstabilityPoolDepositsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StabilityPoolDeposit_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<StabilityPoolDeposit_filter>;
};

export type CollateralAddresses = {
  readonly id: Scalars['ID']['output'];
  readonly borrowerOperations: Scalars['Bytes']['output'];
  readonly collateral: Collateral;
  readonly sortedTroves: Scalars['Bytes']['output'];
  readonly stabilityPool: Scalars['Bytes']['output'];
  readonly token: Scalars['Bytes']['output'];
  readonly troveManager: Scalars['Bytes']['output'];
  readonly troveNft: Scalars['Bytes']['output'];
};

export type CollateralAddresses_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly borrowerOperations?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly borrowerOperations_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly borrowerOperations_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrowerOperations_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly collateral?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_?: InputMaybe<Collateral_filter>;
  readonly sortedTroves?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly sortedTroves_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly sortedTroves_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly sortedTroves_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly stabilityPool_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly stabilityPool_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly stabilityPool_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly token_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly token_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly token_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly troveManager_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly troveManager_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveManager_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly troveNft_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly troveNft_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly troveNft_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<CollateralAddresses_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<CollateralAddresses_filter>>>;
};

export type CollateralAddresses_orderBy =
  | 'id'
  | 'borrowerOperations'
  | 'collateral'
  | 'collateral__id'
  | 'collateral__collIndex'
  | 'collateral__minCollRatio'
  | 'collateral__totalDeposited'
  | 'collateral__totalDebt'
  | 'collateral__price'
  | 'sortedTroves'
  | 'stabilityPool'
  | 'token'
  | 'troveManager'
  | 'troveNft';

export type Collateral_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly collIndex?: InputMaybe<Scalars['Int']['input']>;
  readonly collIndex_not?: InputMaybe<Scalars['Int']['input']>;
  readonly collIndex_gt?: InputMaybe<Scalars['Int']['input']>;
  readonly collIndex_lt?: InputMaybe<Scalars['Int']['input']>;
  readonly collIndex_gte?: InputMaybe<Scalars['Int']['input']>;
  readonly collIndex_lte?: InputMaybe<Scalars['Int']['input']>;
  readonly collIndex_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly collIndex_not_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly token?: InputMaybe<Scalars['String']['input']>;
  readonly token_not?: InputMaybe<Scalars['String']['input']>;
  readonly token_gt?: InputMaybe<Scalars['String']['input']>;
  readonly token_lt?: InputMaybe<Scalars['String']['input']>;
  readonly token_gte?: InputMaybe<Scalars['String']['input']>;
  readonly token_lte?: InputMaybe<Scalars['String']['input']>;
  readonly token_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly token_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly token_contains?: InputMaybe<Scalars['String']['input']>;
  readonly token_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly token_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly token_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly token_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly token_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly token_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly token_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly token_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly token_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly token_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly token_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly token_?: InputMaybe<Token_filter>;
  readonly minCollRatio?: InputMaybe<Scalars['BigInt']['input']>;
  readonly minCollRatio_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly minCollRatio_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly minCollRatio_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly minCollRatio_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly minCollRatio_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly minCollRatio_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly minCollRatio_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly troves_?: InputMaybe<Trove_filter>;
  readonly addresses_?: InputMaybe<CollateralAddresses_filter>;
  readonly stabilityPoolDeposits_?: InputMaybe<StabilityPoolDeposit_filter>;
  readonly totalDeposited?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalDeposited_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalDebt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalDebt_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly price?: InputMaybe<Scalars['BigInt']['input']>;
  readonly price_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly price_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly price_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly price_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly price_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly price_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly price_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<Collateral_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<Collateral_filter>>>;
};

export type Collateral_orderBy =
  | 'id'
  | 'collIndex'
  | 'token'
  | 'token__id'
  | 'token__name'
  | 'token__symbol'
  | 'token__decimals'
  | 'minCollRatio'
  | 'troves'
  | 'addresses'
  | 'addresses__id'
  | 'addresses__borrowerOperations'
  | 'addresses__sortedTroves'
  | 'addresses__stabilityPool'
  | 'addresses__token'
  | 'addresses__troveManager'
  | 'addresses__troveNft'
  | 'stabilityPoolDeposits'
  | 'totalDeposited'
  | 'totalDebt'
  | 'price';

export type InterestRateBracket = {
  readonly id: Scalars['ID']['output'];
  readonly rate: Scalars['BigInt']['output'];
  readonly totalDebt: Scalars['BigInt']['output'];
  readonly totalTroves: Scalars['Int']['output'];
};

export type InterestRateBracket_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly rate?: InputMaybe<Scalars['BigInt']['input']>;
  readonly rate_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly rate_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly rate_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly rate_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly rate_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly rate_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly rate_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalDebt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDebt_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalDebt_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalTroves?: InputMaybe<Scalars['Int']['input']>;
  readonly totalTroves_not?: InputMaybe<Scalars['Int']['input']>;
  readonly totalTroves_gt?: InputMaybe<Scalars['Int']['input']>;
  readonly totalTroves_lt?: InputMaybe<Scalars['Int']['input']>;
  readonly totalTroves_gte?: InputMaybe<Scalars['Int']['input']>;
  readonly totalTroves_lte?: InputMaybe<Scalars['Int']['input']>;
  readonly totalTroves_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly totalTroves_not_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<InterestRateBracket_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<InterestRateBracket_filter>>>;
};

export type InterestRateBracket_orderBy =
  | 'id'
  | 'rate'
  | 'totalDebt'
  | 'totalTroves';

/** Defines the order direction, either ascending or descending */
export type OrderDirection =
  | 'asc'
  | 'desc';

export type Query = {
  readonly collateral?: Maybe<Collateral>;
  readonly collaterals: ReadonlyArray<Collateral>;
  readonly token?: Maybe<Token>;
  readonly tokens: ReadonlyArray<Token>;
  readonly collateralAddresses?: Maybe<CollateralAddresses>;
  readonly collateralAddresses_collection: ReadonlyArray<CollateralAddresses>;
  readonly interestRateBracket?: Maybe<InterestRateBracket>;
  readonly interestRateBrackets: ReadonlyArray<InterestRateBracket>;
  readonly trove?: Maybe<Trove>;
  readonly troves: ReadonlyArray<Trove>;
  readonly borrowerInfo?: Maybe<BorrowerInfo>;
  readonly borrowerInfos: ReadonlyArray<BorrowerInfo>;
  readonly stabilityPool?: Maybe<StabilityPool>;
  readonly stabilityPools: ReadonlyArray<StabilityPool>;
  readonly stabilityPoolDeposit?: Maybe<StabilityPoolDeposit>;
  readonly stabilityPoolDeposits: ReadonlyArray<StabilityPoolDeposit>;
  /** Access to subgraph metadata */
  readonly _meta?: Maybe<_Meta_>;
};


export type QuerycollateralArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerycollateralsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Collateral_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Collateral_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerytokenArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerytokensArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Token_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Token_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerycollateralAddressesArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerycollateralAddresses_collectionArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CollateralAddresses_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<CollateralAddresses_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryinterestRateBracketArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryinterestRateBracketsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<InterestRateBracket_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<InterestRateBracket_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerytroveArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerytrovesArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Trove_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Trove_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryborrowerInfoArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryborrowerInfosArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BorrowerInfo_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<BorrowerInfo_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerystabilityPoolArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerystabilityPoolsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StabilityPool_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<StabilityPool_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerystabilityPoolDepositArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerystabilityPoolDepositsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StabilityPoolDeposit_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<StabilityPoolDeposit_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type Query_metaArgs = {
  block?: InputMaybe<Block_height>;
};

export type StabilityPool = {
  readonly id: Scalars['ID']['output'];
  readonly totalDeposited: Scalars['BigInt']['output'];
};

export type StabilityPoolDeposit = {
  readonly id: Scalars['ID']['output'];
  readonly boldGain: Scalars['BigInt']['output'];
  readonly collGain: Scalars['BigInt']['output'];
  readonly collateral: Collateral;
  readonly deposit: Scalars['BigInt']['output'];
  readonly depositor: Scalars['Bytes']['output'];
};

export type StabilityPoolDeposit_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly boldGain?: InputMaybe<Scalars['BigInt']['input']>;
  readonly boldGain_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly boldGain_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly boldGain_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly boldGain_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly boldGain_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly boldGain_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly boldGain_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly collGain?: InputMaybe<Scalars['BigInt']['input']>;
  readonly collGain_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly collGain_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly collGain_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly collGain_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly collGain_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly collGain_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly collGain_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly collateral?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_?: InputMaybe<Collateral_filter>;
  readonly deposit?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly deposit_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly depositor?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly depositor_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly depositor_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly depositor_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<StabilityPoolDeposit_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<StabilityPoolDeposit_filter>>>;
};

export type StabilityPoolDeposit_orderBy =
  | 'id'
  | 'boldGain'
  | 'collGain'
  | 'collateral'
  | 'collateral__id'
  | 'collateral__collIndex'
  | 'collateral__minCollRatio'
  | 'collateral__totalDeposited'
  | 'collateral__totalDebt'
  | 'collateral__price'
  | 'deposit'
  | 'depositor';

export type StabilityPool_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly totalDeposited?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly totalDeposited_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly totalDeposited_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<StabilityPool_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<StabilityPool_filter>>>;
};

export type StabilityPool_orderBy =
  | 'id'
  | 'totalDeposited';

export type Subscription = {
  readonly collateral?: Maybe<Collateral>;
  readonly collaterals: ReadonlyArray<Collateral>;
  readonly token?: Maybe<Token>;
  readonly tokens: ReadonlyArray<Token>;
  readonly collateralAddresses?: Maybe<CollateralAddresses>;
  readonly collateralAddresses_collection: ReadonlyArray<CollateralAddresses>;
  readonly interestRateBracket?: Maybe<InterestRateBracket>;
  readonly interestRateBrackets: ReadonlyArray<InterestRateBracket>;
  readonly trove?: Maybe<Trove>;
  readonly troves: ReadonlyArray<Trove>;
  readonly borrowerInfo?: Maybe<BorrowerInfo>;
  readonly borrowerInfos: ReadonlyArray<BorrowerInfo>;
  readonly stabilityPool?: Maybe<StabilityPool>;
  readonly stabilityPools: ReadonlyArray<StabilityPool>;
  readonly stabilityPoolDeposit?: Maybe<StabilityPoolDeposit>;
  readonly stabilityPoolDeposits: ReadonlyArray<StabilityPoolDeposit>;
  /** Access to subgraph metadata */
  readonly _meta?: Maybe<_Meta_>;
};


export type SubscriptioncollateralArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptioncollateralsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Collateral_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Collateral_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptiontokenArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptiontokensArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Token_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Token_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptioncollateralAddressesArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptioncollateralAddresses_collectionArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CollateralAddresses_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<CollateralAddresses_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptioninterestRateBracketArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptioninterestRateBracketsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<InterestRateBracket_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<InterestRateBracket_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptiontroveArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptiontrovesArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Trove_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Trove_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionborrowerInfoArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionborrowerInfosArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BorrowerInfo_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<BorrowerInfo_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionstabilityPoolArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionstabilityPoolsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StabilityPool_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<StabilityPool_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionstabilityPoolDepositArgs = {
  id: Scalars['ID']['input'];
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionstabilityPoolDepositsArgs = {
  skip?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StabilityPoolDeposit_orderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<StabilityPoolDeposit_filter>;
  block?: InputMaybe<Block_height>;
  subgraphError?: _SubgraphErrorPolicy_;
};


export type Subscription_metaArgs = {
  block?: InputMaybe<Block_height>;
};

export type Token = {
  readonly id: Scalars['ID']['output'];
  readonly collateral: Collateral;
  readonly name: Scalars['String']['output'];
  readonly symbol: Scalars['String']['output'];
  readonly decimals: Scalars['Int']['output'];
};

export type Token_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly collateral?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_?: InputMaybe<Collateral_filter>;
  readonly name?: InputMaybe<Scalars['String']['input']>;
  readonly name_not?: InputMaybe<Scalars['String']['input']>;
  readonly name_gt?: InputMaybe<Scalars['String']['input']>;
  readonly name_lt?: InputMaybe<Scalars['String']['input']>;
  readonly name_gte?: InputMaybe<Scalars['String']['input']>;
  readonly name_lte?: InputMaybe<Scalars['String']['input']>;
  readonly name_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly name_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly name_contains?: InputMaybe<Scalars['String']['input']>;
  readonly name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly name_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly name_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly name_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly name_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly name_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly name_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly name_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly name_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly name_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly symbol?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_gt?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_lt?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_gte?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_lte?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly symbol_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly symbol_contains?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly symbol_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly decimals?: InputMaybe<Scalars['Int']['input']>;
  readonly decimals_not?: InputMaybe<Scalars['Int']['input']>;
  readonly decimals_gt?: InputMaybe<Scalars['Int']['input']>;
  readonly decimals_lt?: InputMaybe<Scalars['Int']['input']>;
  readonly decimals_gte?: InputMaybe<Scalars['Int']['input']>;
  readonly decimals_lte?: InputMaybe<Scalars['Int']['input']>;
  readonly decimals_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  readonly decimals_not_in?: InputMaybe<ReadonlyArray<Scalars['Int']['input']>>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<Token_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<Token_filter>>>;
};

export type Token_orderBy =
  | 'id'
  | 'collateral'
  | 'collateral__id'
  | 'collateral__collIndex'
  | 'collateral__minCollRatio'
  | 'collateral__totalDeposited'
  | 'collateral__totalDebt'
  | 'collateral__price'
  | 'name'
  | 'symbol'
  | 'decimals';

export type Trove = {
  readonly id: Scalars['ID']['output'];
  readonly troveId: Scalars['String']['output'];
  readonly borrower: Scalars['Bytes']['output'];
  readonly debt: Scalars['BigInt']['output'];
  readonly deposit: Scalars['BigInt']['output'];
  readonly stake: Scalars['BigInt']['output'];
  readonly interestRate: Scalars['BigInt']['output'];
  readonly createdAt: Scalars['BigInt']['output'];
  readonly closedAt?: Maybe<Scalars['BigInt']['output']>;
  readonly collateral: Collateral;
};

export type Trove_filter = {
  readonly id?: InputMaybe<Scalars['ID']['input']>;
  readonly id_not?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lt?: InputMaybe<Scalars['ID']['input']>;
  readonly id_gte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_lte?: InputMaybe<Scalars['ID']['input']>;
  readonly id_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly id_not_in?: InputMaybe<ReadonlyArray<Scalars['ID']['input']>>;
  readonly troveId?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_gt?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_lt?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_gte?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_lte?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly troveId_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly troveId_contains?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly troveId_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly borrower?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_not?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_gt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_lt?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_gte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_lte?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly borrower_not_in?: InputMaybe<ReadonlyArray<Scalars['Bytes']['input']>>;
  readonly borrower_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly borrower_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  readonly debt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly debt_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly debt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly debt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly debt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly debt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly debt_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly debt_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly deposit?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly deposit_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly deposit_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly stake?: InputMaybe<Scalars['BigInt']['input']>;
  readonly stake_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly stake_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly stake_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly stake_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly stake_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly stake_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly stake_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly interestRate?: InputMaybe<Scalars['BigInt']['input']>;
  readonly interestRate_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly interestRate_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly interestRate_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly interestRate_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly interestRate_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly interestRate_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly interestRate_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly createdAt_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly createdAt_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly closedAt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly closedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  readonly closedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly closedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  readonly closedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly closedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  readonly closedAt_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly closedAt_not_in?: InputMaybe<ReadonlyArray<Scalars['BigInt']['input']>>;
  readonly collateral?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lt?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_gte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_lte?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_not_in?: InputMaybe<ReadonlyArray<Scalars['String']['input']>>;
  readonly collateral_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  readonly collateral_?: InputMaybe<Collateral_filter>;
  /** Filter for the block changed event. */
  readonly _change_block?: InputMaybe<BlockChangedFilter>;
  readonly and?: InputMaybe<ReadonlyArray<InputMaybe<Trove_filter>>>;
  readonly or?: InputMaybe<ReadonlyArray<InputMaybe<Trove_filter>>>;
};

export type Trove_orderBy =
  | 'id'
  | 'troveId'
  | 'borrower'
  | 'debt'
  | 'deposit'
  | 'stake'
  | 'interestRate'
  | 'createdAt'
  | 'closedAt'
  | 'collateral'
  | 'collateral__id'
  | 'collateral__collIndex'
  | 'collateral__minCollRatio'
  | 'collateral__totalDeposited'
  | 'collateral__totalDebt'
  | 'collateral__price';

export type _Block_ = {
  /** The hash of the block */
  readonly hash?: Maybe<Scalars['Bytes']['output']>;
  /** The block number */
  readonly number: Scalars['Int']['output'];
  /** Integer representation of the timestamp stored in blocks for the chain */
  readonly timestamp?: Maybe<Scalars['Int']['output']>;
  /** The hash of the parent block */
  readonly parentHash?: Maybe<Scalars['Bytes']['output']>;
};

/** The type for the top-level _meta field */
export type _Meta_ = {
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   *
   */
  readonly block: _Block_;
  /** The deployment ID */
  readonly deployment: Scalars['String']['output'];
  /** If `true`, the subgraph encountered indexing errors at some past block */
  readonly hasIndexingErrors: Scalars['Boolean']['output'];
};

export type _SubgraphErrorPolicy_ =
  /** Data will be returned even if the subgraph has indexing errors */
  | 'allow'
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  | 'deny';

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};

export type LegacyStitchingResolver<TResult, TParent, TContext, TArgs> = {
  fragment: string;
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};

export type NewStitchingResolver<TResult, TParent, TContext, TArgs> = {
  selectionSet: string | ((fieldNode: FieldNode) => SelectionSetNode);
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type StitchingResolver<TResult, TParent, TContext, TArgs> = LegacyStitchingResolver<TResult, TParent, TContext, TArgs> | NewStitchingResolver<TResult, TParent, TContext, TArgs>;
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>
  | StitchingResolver<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Aggregation_interval: Aggregation_interval;
  BigDecimal: ResolverTypeWrapper<Scalars['BigDecimal']['output']>;
  BigInt: ResolverTypeWrapper<Scalars['BigInt']['output']>;
  BlockChangedFilter: BlockChangedFilter;
  Block_height: Block_height;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  BorrowerInfo: ResolverTypeWrapper<BorrowerInfo>;
  BorrowerInfo_filter: BorrowerInfo_filter;
  BorrowerInfo_orderBy: BorrowerInfo_orderBy;
  Bytes: ResolverTypeWrapper<Scalars['Bytes']['output']>;
  Collateral: ResolverTypeWrapper<Collateral>;
  CollateralAddresses: ResolverTypeWrapper<CollateralAddresses>;
  CollateralAddresses_filter: CollateralAddresses_filter;
  CollateralAddresses_orderBy: CollateralAddresses_orderBy;
  Collateral_filter: Collateral_filter;
  Collateral_orderBy: Collateral_orderBy;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Int8: ResolverTypeWrapper<Scalars['Int8']['output']>;
  InterestRateBracket: ResolverTypeWrapper<InterestRateBracket>;
  InterestRateBracket_filter: InterestRateBracket_filter;
  InterestRateBracket_orderBy: InterestRateBracket_orderBy;
  OrderDirection: OrderDirection;
  Query: ResolverTypeWrapper<{}>;
  StabilityPool: ResolverTypeWrapper<StabilityPool>;
  StabilityPoolDeposit: ResolverTypeWrapper<StabilityPoolDeposit>;
  StabilityPoolDeposit_filter: StabilityPoolDeposit_filter;
  StabilityPoolDeposit_orderBy: StabilityPoolDeposit_orderBy;
  StabilityPool_filter: StabilityPool_filter;
  StabilityPool_orderBy: StabilityPool_orderBy;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<{}>;
  Timestamp: ResolverTypeWrapper<Scalars['Timestamp']['output']>;
  Token: ResolverTypeWrapper<Token>;
  Token_filter: Token_filter;
  Token_orderBy: Token_orderBy;
  Trove: ResolverTypeWrapper<Trove>;
  Trove_filter: Trove_filter;
  Trove_orderBy: Trove_orderBy;
  _Block_: ResolverTypeWrapper<_Block_>;
  _Meta_: ResolverTypeWrapper<_Meta_>;
  _SubgraphErrorPolicy_: _SubgraphErrorPolicy_;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  BigDecimal: Scalars['BigDecimal']['output'];
  BigInt: Scalars['BigInt']['output'];
  BlockChangedFilter: BlockChangedFilter;
  Block_height: Block_height;
  Boolean: Scalars['Boolean']['output'];
  BorrowerInfo: BorrowerInfo;
  BorrowerInfo_filter: BorrowerInfo_filter;
  Bytes: Scalars['Bytes']['output'];
  Collateral: Collateral;
  CollateralAddresses: CollateralAddresses;
  CollateralAddresses_filter: CollateralAddresses_filter;
  Collateral_filter: Collateral_filter;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Int8: Scalars['Int8']['output'];
  InterestRateBracket: InterestRateBracket;
  InterestRateBracket_filter: InterestRateBracket_filter;
  Query: {};
  StabilityPool: StabilityPool;
  StabilityPoolDeposit: StabilityPoolDeposit;
  StabilityPoolDeposit_filter: StabilityPoolDeposit_filter;
  StabilityPool_filter: StabilityPool_filter;
  String: Scalars['String']['output'];
  Subscription: {};
  Timestamp: Scalars['Timestamp']['output'];
  Token: Token;
  Token_filter: Token_filter;
  Trove: Trove;
  Trove_filter: Trove_filter;
  _Block_: _Block_;
  _Meta_: _Meta_;
}>;

export type entityDirectiveArgs = { };

export type entityDirectiveResolver<Result, Parent, ContextType = MeshContext, Args = entityDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type subgraphIdDirectiveArgs = {
  id: Scalars['String']['input'];
};

export type subgraphIdDirectiveResolver<Result, Parent, ContextType = MeshContext, Args = subgraphIdDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type derivedFromDirectiveArgs = {
  field: Scalars['String']['input'];
};

export type derivedFromDirectiveResolver<Result, Parent, ContextType = MeshContext, Args = derivedFromDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export interface BigDecimalScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['BigDecimal'], any> {
  name: 'BigDecimal';
}

export interface BigIntScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['BigInt'], any> {
  name: 'BigInt';
}

export type BorrowerInfoResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['BorrowerInfo'] = ResolversParentTypes['BorrowerInfo']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  troves?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  trovesByCollateral?: Resolver<ReadonlyArray<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface BytesScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Bytes'], any> {
  name: 'Bytes';
}

export type CollateralResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Collateral'] = ResolversParentTypes['Collateral']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  collIndex?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  token?: Resolver<ResolversTypes['Token'], ParentType, ContextType>;
  minCollRatio?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  troves?: Resolver<ReadonlyArray<ResolversTypes['Trove']>, ParentType, ContextType, RequireFields<CollateraltrovesArgs, 'skip' | 'first'>>;
  addresses?: Resolver<ResolversTypes['CollateralAddresses'], ParentType, ContextType>;
  stabilityPoolDeposits?: Resolver<ReadonlyArray<ResolversTypes['StabilityPoolDeposit']>, ParentType, ContextType, RequireFields<CollateralstabilityPoolDepositsArgs, 'skip' | 'first'>>;
  totalDeposited?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  totalDebt?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  price?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CollateralAddressesResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['CollateralAddresses'] = ResolversParentTypes['CollateralAddresses']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  borrowerOperations?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  collateral?: Resolver<ResolversTypes['Collateral'], ParentType, ContextType>;
  sortedTroves?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  stabilityPool?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  token?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  troveManager?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  troveNft?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface Int8ScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Int8'], any> {
  name: 'Int8';
}

export type InterestRateBracketResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['InterestRateBracket'] = ResolversParentTypes['InterestRateBracket']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  rate?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  totalDebt?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  totalTroves?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  collateral?: Resolver<Maybe<ResolversTypes['Collateral']>, ParentType, ContextType, RequireFields<QuerycollateralArgs, 'id' | 'subgraphError'>>;
  collaterals?: Resolver<ReadonlyArray<ResolversTypes['Collateral']>, ParentType, ContextType, RequireFields<QuerycollateralsArgs, 'skip' | 'first' | 'subgraphError'>>;
  token?: Resolver<Maybe<ResolversTypes['Token']>, ParentType, ContextType, RequireFields<QuerytokenArgs, 'id' | 'subgraphError'>>;
  tokens?: Resolver<ReadonlyArray<ResolversTypes['Token']>, ParentType, ContextType, RequireFields<QuerytokensArgs, 'skip' | 'first' | 'subgraphError'>>;
  collateralAddresses?: Resolver<Maybe<ResolversTypes['CollateralAddresses']>, ParentType, ContextType, RequireFields<QuerycollateralAddressesArgs, 'id' | 'subgraphError'>>;
  collateralAddresses_collection?: Resolver<ReadonlyArray<ResolversTypes['CollateralAddresses']>, ParentType, ContextType, RequireFields<QuerycollateralAddresses_collectionArgs, 'skip' | 'first' | 'subgraphError'>>;
  interestRateBracket?: Resolver<Maybe<ResolversTypes['InterestRateBracket']>, ParentType, ContextType, RequireFields<QueryinterestRateBracketArgs, 'id' | 'subgraphError'>>;
  interestRateBrackets?: Resolver<ReadonlyArray<ResolversTypes['InterestRateBracket']>, ParentType, ContextType, RequireFields<QueryinterestRateBracketsArgs, 'skip' | 'first' | 'subgraphError'>>;
  trove?: Resolver<Maybe<ResolversTypes['Trove']>, ParentType, ContextType, RequireFields<QuerytroveArgs, 'id' | 'subgraphError'>>;
  troves?: Resolver<ReadonlyArray<ResolversTypes['Trove']>, ParentType, ContextType, RequireFields<QuerytrovesArgs, 'skip' | 'first' | 'subgraphError'>>;
  borrowerInfo?: Resolver<Maybe<ResolversTypes['BorrowerInfo']>, ParentType, ContextType, RequireFields<QueryborrowerInfoArgs, 'id' | 'subgraphError'>>;
  borrowerInfos?: Resolver<ReadonlyArray<ResolversTypes['BorrowerInfo']>, ParentType, ContextType, RequireFields<QueryborrowerInfosArgs, 'skip' | 'first' | 'subgraphError'>>;
  stabilityPool?: Resolver<Maybe<ResolversTypes['StabilityPool']>, ParentType, ContextType, RequireFields<QuerystabilityPoolArgs, 'id' | 'subgraphError'>>;
  stabilityPools?: Resolver<ReadonlyArray<ResolversTypes['StabilityPool']>, ParentType, ContextType, RequireFields<QuerystabilityPoolsArgs, 'skip' | 'first' | 'subgraphError'>>;
  stabilityPoolDeposit?: Resolver<Maybe<ResolversTypes['StabilityPoolDeposit']>, ParentType, ContextType, RequireFields<QuerystabilityPoolDepositArgs, 'id' | 'subgraphError'>>;
  stabilityPoolDeposits?: Resolver<ReadonlyArray<ResolversTypes['StabilityPoolDeposit']>, ParentType, ContextType, RequireFields<QuerystabilityPoolDepositsArgs, 'skip' | 'first' | 'subgraphError'>>;
  _meta?: Resolver<Maybe<ResolversTypes['_Meta_']>, ParentType, ContextType, Partial<Query_metaArgs>>;
}>;

export type StabilityPoolResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['StabilityPool'] = ResolversParentTypes['StabilityPool']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  totalDeposited?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StabilityPoolDepositResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['StabilityPoolDeposit'] = ResolversParentTypes['StabilityPoolDeposit']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  boldGain?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  collGain?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  collateral?: Resolver<ResolversTypes['Collateral'], ParentType, ContextType>;
  deposit?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  depositor?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SubscriptionResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = ResolversObject<{
  collateral?: SubscriptionResolver<Maybe<ResolversTypes['Collateral']>, "collateral", ParentType, ContextType, RequireFields<SubscriptioncollateralArgs, 'id' | 'subgraphError'>>;
  collaterals?: SubscriptionResolver<ReadonlyArray<ResolversTypes['Collateral']>, "collaterals", ParentType, ContextType, RequireFields<SubscriptioncollateralsArgs, 'skip' | 'first' | 'subgraphError'>>;
  token?: SubscriptionResolver<Maybe<ResolversTypes['Token']>, "token", ParentType, ContextType, RequireFields<SubscriptiontokenArgs, 'id' | 'subgraphError'>>;
  tokens?: SubscriptionResolver<ReadonlyArray<ResolversTypes['Token']>, "tokens", ParentType, ContextType, RequireFields<SubscriptiontokensArgs, 'skip' | 'first' | 'subgraphError'>>;
  collateralAddresses?: SubscriptionResolver<Maybe<ResolversTypes['CollateralAddresses']>, "collateralAddresses", ParentType, ContextType, RequireFields<SubscriptioncollateralAddressesArgs, 'id' | 'subgraphError'>>;
  collateralAddresses_collection?: SubscriptionResolver<ReadonlyArray<ResolversTypes['CollateralAddresses']>, "collateralAddresses_collection", ParentType, ContextType, RequireFields<SubscriptioncollateralAddresses_collectionArgs, 'skip' | 'first' | 'subgraphError'>>;
  interestRateBracket?: SubscriptionResolver<Maybe<ResolversTypes['InterestRateBracket']>, "interestRateBracket", ParentType, ContextType, RequireFields<SubscriptioninterestRateBracketArgs, 'id' | 'subgraphError'>>;
  interestRateBrackets?: SubscriptionResolver<ReadonlyArray<ResolversTypes['InterestRateBracket']>, "interestRateBrackets", ParentType, ContextType, RequireFields<SubscriptioninterestRateBracketsArgs, 'skip' | 'first' | 'subgraphError'>>;
  trove?: SubscriptionResolver<Maybe<ResolversTypes['Trove']>, "trove", ParentType, ContextType, RequireFields<SubscriptiontroveArgs, 'id' | 'subgraphError'>>;
  troves?: SubscriptionResolver<ReadonlyArray<ResolversTypes['Trove']>, "troves", ParentType, ContextType, RequireFields<SubscriptiontrovesArgs, 'skip' | 'first' | 'subgraphError'>>;
  borrowerInfo?: SubscriptionResolver<Maybe<ResolversTypes['BorrowerInfo']>, "borrowerInfo", ParentType, ContextType, RequireFields<SubscriptionborrowerInfoArgs, 'id' | 'subgraphError'>>;
  borrowerInfos?: SubscriptionResolver<ReadonlyArray<ResolversTypes['BorrowerInfo']>, "borrowerInfos", ParentType, ContextType, RequireFields<SubscriptionborrowerInfosArgs, 'skip' | 'first' | 'subgraphError'>>;
  stabilityPool?: SubscriptionResolver<Maybe<ResolversTypes['StabilityPool']>, "stabilityPool", ParentType, ContextType, RequireFields<SubscriptionstabilityPoolArgs, 'id' | 'subgraphError'>>;
  stabilityPools?: SubscriptionResolver<ReadonlyArray<ResolversTypes['StabilityPool']>, "stabilityPools", ParentType, ContextType, RequireFields<SubscriptionstabilityPoolsArgs, 'skip' | 'first' | 'subgraphError'>>;
  stabilityPoolDeposit?: SubscriptionResolver<Maybe<ResolversTypes['StabilityPoolDeposit']>, "stabilityPoolDeposit", ParentType, ContextType, RequireFields<SubscriptionstabilityPoolDepositArgs, 'id' | 'subgraphError'>>;
  stabilityPoolDeposits?: SubscriptionResolver<ReadonlyArray<ResolversTypes['StabilityPoolDeposit']>, "stabilityPoolDeposits", ParentType, ContextType, RequireFields<SubscriptionstabilityPoolDepositsArgs, 'skip' | 'first' | 'subgraphError'>>;
  _meta?: SubscriptionResolver<Maybe<ResolversTypes['_Meta_']>, "_meta", ParentType, ContextType, Partial<Subscription_metaArgs>>;
}>;

export interface TimestampScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Timestamp'], any> {
  name: 'Timestamp';
}

export type TokenResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Token'] = ResolversParentTypes['Token']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  collateral?: Resolver<ResolversTypes['Collateral'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  symbol?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  decimals?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TroveResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Trove'] = ResolversParentTypes['Trove']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  troveId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  borrower?: Resolver<ResolversTypes['Bytes'], ParentType, ContextType>;
  debt?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  deposit?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  stake?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  interestRate?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['BigInt'], ParentType, ContextType>;
  closedAt?: Resolver<Maybe<ResolversTypes['BigInt']>, ParentType, ContextType>;
  collateral?: Resolver<ResolversTypes['Collateral'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type _Block_Resolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['_Block_'] = ResolversParentTypes['_Block_']> = ResolversObject<{
  hash?: Resolver<Maybe<ResolversTypes['Bytes']>, ParentType, ContextType>;
  number?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  timestamp?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  parentHash?: Resolver<Maybe<ResolversTypes['Bytes']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type _Meta_Resolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['_Meta_'] = ResolversParentTypes['_Meta_']> = ResolversObject<{
  block?: Resolver<ResolversTypes['_Block_'], ParentType, ContextType>;
  deployment?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  hasIndexingErrors?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = MeshContext> = ResolversObject<{
  BigDecimal?: GraphQLScalarType;
  BigInt?: GraphQLScalarType;
  BorrowerInfo?: BorrowerInfoResolvers<ContextType>;
  Bytes?: GraphQLScalarType;
  Collateral?: CollateralResolvers<ContextType>;
  CollateralAddresses?: CollateralAddressesResolvers<ContextType>;
  Int8?: GraphQLScalarType;
  InterestRateBracket?: InterestRateBracketResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  StabilityPool?: StabilityPoolResolvers<ContextType>;
  StabilityPoolDeposit?: StabilityPoolDepositResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  Timestamp?: GraphQLScalarType;
  Token?: TokenResolvers<ContextType>;
  Trove?: TroveResolvers<ContextType>;
  _Block_?: _Block_Resolvers<ContextType>;
  _Meta_?: _Meta_Resolvers<ContextType>;
}>;

export type DirectiveResolvers<ContextType = MeshContext> = ResolversObject<{
  entity?: entityDirectiveResolver<any, any, ContextType>;
  subgraphId?: subgraphIdDirectiveResolver<any, any, ContextType>;
  derivedFrom?: derivedFromDirectiveResolver<any, any, ContextType>;
}>;

export type MeshContext = Liquity2Types.Context & BaseMeshContext;


import { fileURLToPath } from '@graphql-mesh/utils';
const baseDir = pathModule.join(pathModule.dirname(fileURLToPath(import.meta.url)), '..');

const importFn: ImportFn = <T>(moduleId: string) => {
  const relativeModuleId = (pathModule.isAbsolute(moduleId) ? pathModule.relative(baseDir, moduleId) : moduleId).split('\\').join('/').replace(baseDir + '/', '');
  switch(relativeModuleId) {
    case ".graphclient/sources/liquity2/introspectionSchema":
      return Promise.resolve(importedModule$0) as T;
    
    default:
      return Promise.reject(new Error(`Cannot find module '${relativeModuleId}'.`));
  }
};

const rootStore = new MeshStore('.graphclient', new FsStoreStorageAdapter({
  cwd: baseDir,
  importFn,
  fileType: "ts",
}), {
  readonly: true,
  validate: false
});

export const rawServeConfig: YamlConfig.Config['serve'] = undefined as any
export async function getMeshOptions(): Promise<GetMeshOptions> {
const pubsub = new PubSub();
const sourcesStore = rootStore.child('sources');
const logger = new DefaultLogger("GraphClient");
const cache = new (MeshCache as any)({
      ...({} as any),
      importFn,
      store: rootStore.child('cache'),
      pubsub,
      logger,
    } as any)

const sources: MeshResolvedSource[] = [];
const transforms: MeshTransform[] = [];
const additionalEnvelopPlugins: MeshPlugin<any>[] = [];
const liquity2Transforms = [];
const additionalTypeDefs = [] as any[];
const liquity2Handler = new GraphqlHandler({
              name: "liquity2",
              config: {"endpoint":"https://api.studio.thegraph.com/query/42403/liquity2/version/latest"},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("liquity2"),
              logger: logger.child("liquity2"),
              importFn,
            });
sources[0] = {
          name: 'liquity2',
          handler: liquity2Handler,
          transforms: liquity2Transforms
        }
const additionalResolvers = [] as any[]
const merger = new(BareMerger as any)({
        cache,
        pubsub,
        logger: logger.child('bareMerger'),
        store: rootStore.child('bareMerger')
      })
const documentHashMap = {
        "6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d": TrovesByAccountDocument,
"6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d": TrovesCountDocument,
"6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d": TroveByIdDocument,
"6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d": StabilityPoolDepositsByAccountDocument,
"6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d": StabilityPoolDepositDocument,
"6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d": StabilityPoolDocument
      }
additionalEnvelopPlugins.push(usePersistedOperations({
        getPersistedOperation(key) {
          return documentHashMap[key];
        },
        ...{}
      }))

  return {
    sources,
    transforms,
    additionalTypeDefs,
    additionalResolvers,
    cache,
    pubsub,
    merger,
    logger,
    additionalEnvelopPlugins,
    get documents() {
      return [
      {
        document: TrovesByAccountDocument,
        get rawSDL() {
          return printWithCache(TrovesByAccountDocument);
        },
        location: 'TrovesByAccountDocument.graphql',
        sha256Hash: '6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d'
      },{
        document: TrovesCountDocument,
        get rawSDL() {
          return printWithCache(TrovesCountDocument);
        },
        location: 'TrovesCountDocument.graphql',
        sha256Hash: '6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d'
      },{
        document: TroveByIdDocument,
        get rawSDL() {
          return printWithCache(TroveByIdDocument);
        },
        location: 'TroveByIdDocument.graphql',
        sha256Hash: '6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d'
      },{
        document: StabilityPoolDepositsByAccountDocument,
        get rawSDL() {
          return printWithCache(StabilityPoolDepositsByAccountDocument);
        },
        location: 'StabilityPoolDepositsByAccountDocument.graphql',
        sha256Hash: '6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d'
      },{
        document: StabilityPoolDepositDocument,
        get rawSDL() {
          return printWithCache(StabilityPoolDepositDocument);
        },
        location: 'StabilityPoolDepositDocument.graphql',
        sha256Hash: '6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d'
      },{
        document: StabilityPoolDocument,
        get rawSDL() {
          return printWithCache(StabilityPoolDocument);
        },
        location: 'StabilityPoolDocument.graphql',
        sha256Hash: '6c400d0d0083d93b7163800dcabfb47af188c4b489df5cebc94c1e040c7eba8d'
      }
    ];
    },
    fetchFn,
  };
}

export function createBuiltMeshHTTPHandler<TServerContext = {}>(): MeshHTTPHandler<TServerContext> {
  return createMeshHTTPHandler<TServerContext>({
    baseDir,
    getBuiltMesh: getBuiltGraphClient,
    rawServeConfig: undefined,
  })
}


let meshInstance$: Promise<MeshInstance> | undefined;

export const pollingInterval = null;

export function getBuiltGraphClient(): Promise<MeshInstance> {
  if (meshInstance$ == null) {
    if (pollingInterval) {
      setInterval(() => {
        getMeshOptions()
        .then(meshOptions => getMesh(meshOptions))
        .then(newMesh =>
          meshInstance$.then(oldMesh => {
            oldMesh.destroy()
            meshInstance$ = Promise.resolve(newMesh)
          })
        ).catch(err => {
          console.error("Mesh polling failed so the existing version will be used:", err);
        });
      }, pollingInterval)
    }
    meshInstance$ = getMeshOptions().then(meshOptions => getMesh(meshOptions)).then(mesh => {
      const id = mesh.pubsub.subscribe('destroy', () => {
        meshInstance$ = undefined;
        mesh.pubsub.unsubscribe(id);
      });
      return mesh;
    });
  }
  return meshInstance$;
}

export const execute: ExecuteMeshFn = (...args) => getBuiltGraphClient().then(({ execute }) => execute(...args));

export const subscribe: SubscribeMeshFn = (...args) => getBuiltGraphClient().then(({ subscribe }) => subscribe(...args));
export function getBuiltGraphSDK<TGlobalContext = any, TOperationContext = any>(globalContext?: TGlobalContext) {
  const sdkRequester$ = getBuiltGraphClient().then(({ sdkRequesterFactory }) => sdkRequesterFactory(globalContext));
  return getSdk<TOperationContext, TGlobalContext>((...args) => sdkRequester$.then(sdkRequester => sdkRequester(...args)));
}
export type TrovesByAccountQueryVariables = Exact<{
  account: Scalars['Bytes']['input'];
}>;


export type TrovesByAccountQuery = { readonly troves: ReadonlyArray<(
    Pick<Trove, 'id' | 'troveId' | 'borrower' | 'debt' | 'deposit' | 'stake' | 'interestRate' | 'createdAt' | 'closedAt'>
    & { readonly collateral: (
      Pick<Collateral, 'id' | 'minCollRatio' | 'collIndex'>
      & { readonly token: Pick<Token, 'symbol' | 'name'> }
    ) }
  )> };

export type TrovesCountQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TrovesCountQuery = { readonly borrowerInfo?: Maybe<Pick<BorrowerInfo, 'troves' | 'trovesByCollateral'>> };

export type TroveByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TroveByIdQuery = { readonly trove?: Maybe<(
    Pick<Trove, 'id' | 'troveId' | 'borrower' | 'debt' | 'deposit' | 'stake' | 'interestRate' | 'createdAt' | 'closedAt'>
    & { readonly collateral: (
      Pick<Collateral, 'id' | 'minCollRatio' | 'collIndex'>
      & { readonly token: Pick<Token, 'symbol' | 'name'> }
    ) }
  )> };

export type StabilityPoolDepositsByAccountQueryVariables = Exact<{
  account: Scalars['Bytes']['input'];
}>;


export type StabilityPoolDepositsByAccountQuery = { readonly stabilityPoolDeposits: ReadonlyArray<(
    Pick<StabilityPoolDeposit, 'id' | 'boldGain' | 'collGain' | 'deposit'>
    & { readonly collateral: Pick<Collateral, 'collIndex'> }
  )> };

export type StabilityPoolDepositQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type StabilityPoolDepositQuery = { readonly stabilityPoolDeposit?: Maybe<(
    Pick<StabilityPoolDeposit, 'id' | 'boldGain' | 'collGain' | 'deposit' | 'depositor'>
    & { readonly collateral: Pick<Collateral, 'collIndex'> }
  )> };

export type StabilityPoolQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type StabilityPoolQuery = { readonly stabilityPool?: Maybe<Pick<StabilityPool, 'id' | 'totalDeposited'>> };


export const TrovesByAccountDocument = gql`
    query TrovesByAccount($account: Bytes!) {
  troves(where: {borrower: $account, closedAt: null}) {
    id
    troveId
    borrower
    debt
    deposit
    stake
    interestRate
    createdAt
    closedAt
    collateral {
      id
      token {
        symbol
        name
      }
      minCollRatio
      collIndex
    }
  }
}
    ` as unknown as DocumentNode<TrovesByAccountQuery, TrovesByAccountQueryVariables>;
export const TrovesCountDocument = gql`
    query TrovesCount($id: ID!) {
  borrowerInfo(id: $id) {
    troves
    trovesByCollateral
  }
}
    ` as unknown as DocumentNode<TrovesCountQuery, TrovesCountQueryVariables>;
export const TroveByIdDocument = gql`
    query TroveById($id: ID!) {
  trove(id: $id) {
    id
    troveId
    borrower
    debt
    deposit
    stake
    interestRate
    createdAt
    closedAt
    collateral {
      id
      token {
        symbol
        name
      }
      minCollRatio
      collIndex
    }
  }
}
    ` as unknown as DocumentNode<TroveByIdQuery, TroveByIdQueryVariables>;
export const StabilityPoolDepositsByAccountDocument = gql`
    query StabilityPoolDepositsByAccount($account: Bytes!) {
  stabilityPoolDeposits(where: {depositor: $account, deposit_gt: 0}) {
    id
    boldGain
    collGain
    deposit
    collateral {
      collIndex
    }
  }
}
    ` as unknown as DocumentNode<StabilityPoolDepositsByAccountQuery, StabilityPoolDepositsByAccountQueryVariables>;
export const StabilityPoolDepositDocument = gql`
    query StabilityPoolDeposit($id: ID!) {
  stabilityPoolDeposit(id: $id) {
    id
    boldGain
    collGain
    deposit
    depositor
    collateral {
      collIndex
    }
  }
}
    ` as unknown as DocumentNode<StabilityPoolDepositQuery, StabilityPoolDepositQueryVariables>;
export const StabilityPoolDocument = gql`
    query StabilityPool($id: ID!) {
  stabilityPool(id: $id) {
    id
    totalDeposited
  }
}
    ` as unknown as DocumentNode<StabilityPoolQuery, StabilityPoolQueryVariables>;







export type Requester<C = {}, E = unknown> = <R, V>(doc: DocumentNode, vars?: V, options?: C) => Promise<R> | AsyncIterable<R>
export function getSdk<C, E>(requester: Requester<C, E>) {
  return {
    TrovesByAccount(variables: TrovesByAccountQueryVariables, options?: C): Promise<TrovesByAccountQuery> {
      return requester<TrovesByAccountQuery, TrovesByAccountQueryVariables>(TrovesByAccountDocument, variables, options) as Promise<TrovesByAccountQuery>;
    },
    TrovesCount(variables: TrovesCountQueryVariables, options?: C): Promise<TrovesCountQuery> {
      return requester<TrovesCountQuery, TrovesCountQueryVariables>(TrovesCountDocument, variables, options) as Promise<TrovesCountQuery>;
    },
    TroveById(variables: TroveByIdQueryVariables, options?: C): Promise<TroveByIdQuery> {
      return requester<TroveByIdQuery, TroveByIdQueryVariables>(TroveByIdDocument, variables, options) as Promise<TroveByIdQuery>;
    },
    StabilityPoolDepositsByAccount(variables: StabilityPoolDepositsByAccountQueryVariables, options?: C): Promise<StabilityPoolDepositsByAccountQuery> {
      return requester<StabilityPoolDepositsByAccountQuery, StabilityPoolDepositsByAccountQueryVariables>(StabilityPoolDepositsByAccountDocument, variables, options) as Promise<StabilityPoolDepositsByAccountQuery>;
    },
    StabilityPoolDeposit(variables: StabilityPoolDepositQueryVariables, options?: C): Promise<StabilityPoolDepositQuery> {
      return requester<StabilityPoolDepositQuery, StabilityPoolDepositQueryVariables>(StabilityPoolDepositDocument, variables, options) as Promise<StabilityPoolDepositQuery>;
    },
    StabilityPool(variables: StabilityPoolQueryVariables, options?: C): Promise<StabilityPoolQuery> {
      return requester<StabilityPoolQuery, StabilityPoolQueryVariables>(StabilityPoolDocument, variables, options) as Promise<StabilityPoolQuery>;
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;