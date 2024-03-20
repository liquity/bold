import { FormField } from "@/src/comps/FormField/FormField";
import { TextInput } from "@/src/comps/Input/TextInput";
import { Contract } from "./Contract";
import { ContractAction } from "./ContractAction";

export function ContractStabilityPool() {
  return (
    <Contract name="StabilityPool.sol">
      <ProvideToSp />
      <WithdrawFromSp />
      <WithdrawEthGainToTrove />
    </Contract>
  );
}

function ProvideToSp() {
  return (
    <ContractAction title="Provide to SP">
      <FormField label="Amount">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}

function WithdrawFromSp() {
  return (
    <ContractAction title="Withdraw from SP">
      <FormField label="Amount">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}

function WithdrawEthGainToTrove() {
  return (
    <ContractAction title="Withdraw ETH Gain to Trove">
    </ContractAction>
  );
}
