import { parseAbiItem, type BlockTag } from "viem";
import { getPublicClient } from "@/src/shellpoints/utils/client";
import { getContracts } from "@/src/contracts";
import { ORIGIN_BLOCK } from "@/src/shellpoints/utils/constants";

export async function getAllHistoricalStabilityPoolDepositors() {
  const events = await queryStabilityPoolDepositUpdatedEvents();

  return events.map((event: any) => event.args._depositor);
}

export async function queryStabilityPoolDepositUpdatedEvents({
  fromBlock = ORIGIN_BLOCK,
  toBlock = 'latest',
}: {
  fromBlock?: bigint | BlockTag
  toBlock?: bigint | BlockTag
} = {}) {
  const client = getPublicClient();
  const contracts = getContracts();

  const filter = await client.createEventFilter({
    address: contracts.collaterals.map(collateral => collateral.contracts.StabilityPool.address),
    event: parseAbiItem('event DepositUpdated(address indexed _depositor,uint256 _newDeposit,uint256 _stashedColl,uint256 _snapshotP,uint256 _snapshotS,uint256 _snapshotB,uint256 _snapshotScale)'),
    strict: true,
    fromBlock,
    toBlock
  })

  return await client.getFilterLogs({ filter });
}