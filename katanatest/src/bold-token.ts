import {
  ActivePoolAddressAdded as ActivePoolAddressAddedEvent,
  Approval as ApprovalEvent,
  BorrowerOperationsAddressAdded as BorrowerOperationsAddressAddedEvent,
  CollateralRegistryAddressChanged as CollateralRegistryAddressChangedEvent,
  EIP712DomainChanged as EIP712DomainChangedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  StabilityPoolAddressAdded as StabilityPoolAddressAddedEvent,
  Transfer as TransferEvent,
  TroveManagerAddressAdded as TroveManagerAddressAddedEvent
} from "../generated/BoldToken/BoldToken"
import {
  ActivePoolAddressAdded,
  Approval,
  BorrowerOperationsAddressAdded,
  CollateralRegistryAddressChanged,
  EIP712DomainChanged,
  OwnershipTransferred,
  StabilityPoolAddressAdded,
  Transfer,
  TroveManagerAddressAdded
} from "../generated/schema"

export function handleActivePoolAddressAdded(
  event: ActivePoolAddressAddedEvent
): void {
  let entity = new ActivePoolAddressAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity._newActivePoolAddress = event.params._newActivePoolAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.owner = event.params.owner
  entity.spender = event.params.spender
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleBorrowerOperationsAddressAdded(
  event: BorrowerOperationsAddressAddedEvent
): void {
  let entity = new BorrowerOperationsAddressAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity._newBorrowerOperationsAddress =
    event.params._newBorrowerOperationsAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleCollateralRegistryAddressChanged(
  event: CollateralRegistryAddressChangedEvent
): void {
  let entity = new CollateralRegistryAddressChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity._newCollateralRegistryAddress =
    event.params._newCollateralRegistryAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEIP712DomainChanged(
  event: EIP712DomainChangedEvent
): void {
  let entity = new EIP712DomainChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleStabilityPoolAddressAdded(
  event: StabilityPoolAddressAddedEvent
): void {
  let entity = new StabilityPoolAddressAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity._newStabilityPoolAddress = event.params._newStabilityPoolAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTransfer(event: TransferEvent): void {
  let entity = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.from = event.params.from
  entity.to = event.params.to
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTroveManagerAddressAdded(
  event: TroveManagerAddressAddedEvent
): void {
  let entity = new TroveManagerAddressAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity._newTroveManagerAddress = event.params._newTroveManagerAddress

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
