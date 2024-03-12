import { InputField } from "@/src/comps/InputField/InputField";
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
  return <ContractAction title="Close Trove" />;
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
  return (
    <ContractAction title="Open Trove">
      <InputField label="Max Fee Percentage" />
      <InputField label="BOLD Amount" />
      <InputField label="Upper Hint" />
      <InputField label="Lower Hint" />
      <InputField label="Annual Interest Rate" />
    </ContractAction>
  );
}
