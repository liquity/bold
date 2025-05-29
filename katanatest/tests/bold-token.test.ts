import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { ActivePoolAddressAdded } from "../generated/schema"
import { ActivePoolAddressAdded as ActivePoolAddressAddedEvent } from "../generated/BoldToken/BoldToken"
import { handleActivePoolAddressAdded } from "../src/bold-token"
import { createActivePoolAddressAddedEvent } from "./bold-token-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let _newActivePoolAddress = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let newActivePoolAddressAddedEvent = createActivePoolAddressAddedEvent(
      _newActivePoolAddress
    )
    handleActivePoolAddressAdded(newActivePoolAddressAddedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("ActivePoolAddressAdded created and stored", () => {
    assert.entityCount("ActivePoolAddressAdded", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "ActivePoolAddressAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "_newActivePoolAddress",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
