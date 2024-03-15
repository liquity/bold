import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { InputField } from "@/src/comps/InputField/InputField";
import { CONTRACT_BORROWER_OPERATIONS } from "@/src/env";
import { useAccount, useWriteContract } from "wagmi";
import { Contract } from "./Contract";
import { ContractAction } from "./ContractAction";

export function ContractBorrowerOperations() {
  return (
    <Contract name="BorrowerOperations.sol">
      <OpenTrove />
      <AddCollateral />
      <WithdrawCollateral />
      <WithdrawBold />
      <RepayBold />
      <AdjustTrove />
      <AdjustTroveInterestRate />
      <CloseTrove />
    </Contract>
  );
}

function CloseTrove() {
  const account = useAccount();
  const { writeContract } = useWriteContract();
  return (
    <ContractAction
      title="Close Trove"
      onSubmit={() => {
        if (account.address) {
          writeContract({
            abi: BorrowerOperations,
            address: CONTRACT_BORROWER_OPERATIONS,
            functionName: "closeTrove",
            args: [],
          });
        }
      }}
    />
  );
}

function AdjustTroveInterestRate() {
  return (
    <ContractAction title="Adjust Trove Interest Rate">
      <InputField label="New Annual Interest Rate" />
      <InputField label="Upper Hint" />
      <InputField label="Lower Hint" />
    </ContractAction>
  );
}

function AdjustTrove() {
  return (
    <ContractAction title="Adjust Trove">
      <InputField label="Max Fee Percentage" />
      <InputField label="Collateral withdrawal" />
      <InputField label="BOLD Amount" />
      <InputField label="Is Debt Increase" />
    </ContractAction>
  );
}

function RepayBold() {
  return (
    <ContractAction title="Repay BOLD">
      <InputField label="BOLD Amount" />
    </ContractAction>
  );
}

function AddCollateral() {
  return (
    <ContractAction title="Add Collateral">
      <InputField label="ETH Amount" />
    </ContractAction>
  );
}

function WithdrawCollateral() {
  return (
    <ContractAction title="Withdraw Collateral">
      <InputField label="ETH Amount" />
    </ContractAction>
  );
}

function WithdrawBold() {
  return (
    <ContractAction title="Withdraw BOLD">
      <InputField label="Max Fee Percentage" />
      <InputField label="BOLD Amount" />
    </ContractAction>
  );
}

function OpenTrove() {
  const account = useAccount();
  const { writeContract } = useWriteContract();
  return (
    <ContractAction
      title="Open Trove"
      onSubmit={() => {
        if (account.address) {
          writeContract({
            abi: BorrowerOperations,
            address: CONTRACT_BORROWER_OPERATIONS,
            functionName: "openTrove",
            args: [
              100n * 10n ** 16n, // 100%
              1800n * 10n ** 18n, // 1800 BOLD
              account.address,
              account.address,
              5n * 10n ** 16n, // 5%
            ],
            value: 20n * 10n ** 18n, // 20 ETH
          });
        }
      }}
    >
      <InputField label="Max Fee Percentage" />
      <InputField label="BOLD Amount" />
      <InputField label="Upper Hint" />
      <InputField label="Lower Hint" />
      <InputField label="Annual Interest Rate" />
    </ContractAction>
  );
}
