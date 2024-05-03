import { StabilityPoolContract } from "@/src/contracts";
import { formValue, parseInputInt, parseInputValue, useForm } from "@/src/form-utils";
import { getTroveId } from "@/src/liquity-utils";
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
      <WithdrawEthGainToTrove />
    </Contract>
  );
}

function ProvideToSp() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    amount: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...StabilityPoolContract,
        functionName: "provideToSP",
        args: [
          values.amount[0],
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
      <FormField label="Amount">
        <TextInput {...fieldsProps.amount} />
      </FormField>
    </ContractAction>
  );
}

function WithdrawFromSp() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    amount: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...StabilityPoolContract,
        functionName: "withdrawFromSP",
        args: [
          values.amount[0],
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
    </ContractAction>
  );
}

function WithdrawEthGainToTrove() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...StabilityPoolContract,
        functionName: "withdrawETHGainToTrove",
        args: [
          getTroveId(account.address, values.ownerIndex),
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Withdraw ETH Gain to Trove"
    >
      <FormField label="Trove Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
    </ContractAction>
  );
}
