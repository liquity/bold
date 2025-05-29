import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
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
} from "../generated/BoldToken/BoldToken"

export function createActivePoolAddressAddedEvent(
  _newActivePoolAddress: Address
): ActivePoolAddressAdded {
  let activePoolAddressAddedEvent =
    changetype<ActivePoolAddressAdded>(newMockEvent())

  activePoolAddressAddedEvent.parameters = new Array()

  activePoolAddressAddedEvent.parameters.push(
    new ethereum.EventParam(
      "_newActivePoolAddress",
      ethereum.Value.fromAddress(_newActivePoolAddress)
    )
  )

  return activePoolAddressAddedEvent
}

export function createApprovalEvent(
  owner: Address,
  spender: Address,
  value: BigInt
): Approval {
  let approvalEvent = changetype<Approval>(newMockEvent())

  approvalEvent.parameters = new Array()

  approvalEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  approvalEvent.parameters.push(
    new ethereum.EventParam("spender", ethereum.Value.fromAddress(spender))
  )
  approvalEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return approvalEvent
}

export function createBorrowerOperationsAddressAddedEvent(
  _newBorrowerOperationsAddress: Address
): BorrowerOperationsAddressAdded {
  let borrowerOperationsAddressAddedEvent =
    changetype<BorrowerOperationsAddressAdded>(newMockEvent())

  borrowerOperationsAddressAddedEvent.parameters = new Array()

  borrowerOperationsAddressAddedEvent.parameters.push(
    new ethereum.EventParam(
      "_newBorrowerOperationsAddress",
      ethereum.Value.fromAddress(_newBorrowerOperationsAddress)
    )
  )

  return borrowerOperationsAddressAddedEvent
}

export function createCollateralRegistryAddressChangedEvent(
  _newCollateralRegistryAddress: Address
): CollateralRegistryAddressChanged {
  let collateralRegistryAddressChangedEvent =
    changetype<CollateralRegistryAddressChanged>(newMockEvent())

  collateralRegistryAddressChangedEvent.parameters = new Array()

  collateralRegistryAddressChangedEvent.parameters.push(
    new ethereum.EventParam(
      "_newCollateralRegistryAddress",
      ethereum.Value.fromAddress(_newCollateralRegistryAddress)
    )
  )

  return collateralRegistryAddressChangedEvent
}

export function createEIP712DomainChangedEvent(): EIP712DomainChanged {
  let eip712DomainChangedEvent = changetype<EIP712DomainChanged>(newMockEvent())

  eip712DomainChangedEvent.parameters = new Array()

  return eip712DomainChangedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createStabilityPoolAddressAddedEvent(
  _newStabilityPoolAddress: Address
): StabilityPoolAddressAdded {
  let stabilityPoolAddressAddedEvent =
    changetype<StabilityPoolAddressAdded>(newMockEvent())

  stabilityPoolAddressAddedEvent.parameters = new Array()

  stabilityPoolAddressAddedEvent.parameters.push(
    new ethereum.EventParam(
      "_newStabilityPoolAddress",
      ethereum.Value.fromAddress(_newStabilityPoolAddress)
    )
  )

  return stabilityPoolAddressAddedEvent
}

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent())

  transferEvent.parameters = new Array()

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return transferEvent
}

export function createTroveManagerAddressAddedEvent(
  _newTroveManagerAddress: Address
): TroveManagerAddressAdded {
  let troveManagerAddressAddedEvent =
    changetype<TroveManagerAddressAdded>(newMockEvent())

  troveManagerAddressAddedEvent.parameters = new Array()

  troveManagerAddressAddedEvent.parameters.push(
    new ethereum.EventParam(
      "_newTroveManagerAddress",
      ethereum.Value.fromAddress(_newTroveManagerAddress)
    )
  )

  return troveManagerAddressAddedEvent
}
