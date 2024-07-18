import { StabilityPoolContract } from "@/src/contracts";
import { formValue, parseInputFloat, useForm } from "@/src/form-utils";
import { FormField, TextInput } from "@liquity2/uikit";
import * as dn from "dnum";
import { useAccount, useWriteContract } from "wagmi";
import { Contract } from "./Contract";
import { ContractAction } from "./ContractAction";

export function ContractStabilityPool() {
  return (
    <Contract name="StabilityPool.sol">
      <ProvideToSp />
      <WithdrawFromSp />
    </Contract>
  );
}

function ProvideToSp() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    topUp: formValue(dn.from(0, 18), parseInputFloat),
    doClaim: formValue(false, (value) => value === "true"),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...StabilityPoolContract,
        functionName: "provideToSP",
        args: [
          values.topUp[0],
          values.doClaim,
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Provide to SP"
    >
      <FormField label="Top Up">
        <TextInput {...fieldsProps.topUp} />
      </FormField>
      <FormField label="Do Claim">
        <TextInput {...fieldsProps.doClaim} />
      </FormField>
    </ContractAction>
  );
}

function WithdrawFromSp() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    amount: formValue(dn.from(0, 18), parseInputFloat),
    doClaim: formValue(false, (value) => value === "true"),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...StabilityPoolContract,
        functionName: "withdrawFromSP",
        args: [
          values.amount[0],
          values.doClaim,
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Withdraw from SP"
    >
      <FormField label="Amount">
        <TextInput {...fieldsProps.amount} />
      </FormField>
      <FormField label="Do Claim">
        <TextInput {...fieldsProps.doClaim} />
      </FormField>
    </ContractAction>
  );
}
