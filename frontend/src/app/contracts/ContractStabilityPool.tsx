import { InputField } from "@/src/comps/InputField/InputField";
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
      <InputField label="Amount" />
    </ContractAction>
  );
}

function WithdrawFromSp() {
  return (
    <ContractAction title="Withdraw from SP">
      <InputField label="Amount" />
    </ContractAction>
  );
}

function WithdrawEthGainToTrove() {
  return <ContractAction title="Withdraw ETH Gain to Trove" />;
}
