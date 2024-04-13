import { FormField } from "@/src/comps/FormField/FormField";
import { TextInput } from "@/src/comps/Input/TextInput";
import { BorrowerOperationsContract } from "@/src/contracts";
import { formValue, parseInputInt, parseInputPercentage, parseInputValue, useForm } from "@/src/form-utils";
import { getTroveId } from "@/src/liquity-utils";
import * as dn from "dnum";
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
      <CloseTrove />
      <RepayBold />
      <AdjustTrove />
      <AdjustTroveInterestRate />
    </Contract>
  );
}

function OpenTrove() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    maxFeePercentage: formValue(dn.from(0, 18), parseInputValue),
    ethAmount: formValue(dn.from(0, 18), parseInputValue),
    boldAmount: formValue(dn.from(0, 18), parseInputValue),
    upperHint: formValue(dn.from(0, 18), parseInputValue),
    lowerHint: formValue(dn.from(0, 18), parseInputValue),
    annualInterestRate: formValue(dn.from(0, 18), parseInputPercentage),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "openTrove",
        args: [
          account.address,
          values.ownerIndex,
          values.maxFeePercentage[0],
          values.ethAmount[0],
          values.boldAmount[0],
          values.upperHint[0],
          values.lowerHint[0],
          values.annualInterestRate[0],
        ],
      });
    }
  };

  // const onFillExample = () => {
  //   setFormValues({
  //     ownerIndex: ["0", 0n],
  //     maxFeePercentage: ["100", [100n * 10n ** 16n, 18]],
  //     ethAmount: ["20", [20n * 10n ** 18n, 18]],
  //     boldAmount: ["1800", [1800n * 10n ** 18n, 18]],
  //     upperHint: ["0", [0n, 18]],
  //     lowerHint: ["0", [0n, 18]],
  //     annualInterestRate: ["5", [5n * 10n ** 16n, 18]],
  //   });
  // };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Open Trove"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="Max Fee Percentage">
        <TextInput {...fieldsProps.maxFeePercentage} />
      </FormField>
      <FormField label="ETH Amount">
        <TextInput {...fieldsProps.ethAmount} />
      </FormField>
      <FormField label="BOLD Amount">
        <TextInput {...fieldsProps.boldAmount} />
      </FormField>
      <FormField label="Upper Hint">
        <TextInput {...fieldsProps.upperHint} />
      </FormField>
      <FormField label="Lower Hint">
        <TextInput {...fieldsProps.lowerHint} />
      </FormField>
      <FormField label="Annual Interest Rate">
        <TextInput {...fieldsProps.annualInterestRate} />
      </FormField>
    </ContractAction>
  );
}

function CloseTrove() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "closeTrove",
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
      title="Close Trove"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
    </ContractAction>
  );
}

function RepayBold() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    boldAmount: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "repayBold",
        args: [
          getTroveId(account.address, values.ownerIndex),
          values.boldAmount[0],
        ],
      });
    }
  };
  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Repay BOLD"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="BOLD Amount">
        <TextInput {...fieldsProps.boldAmount} />
      </FormField>
    </ContractAction>
  );
}

function AddCollateral() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    ethAmount: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "addColl",
        args: [
          getTroveId(account.address, values.ownerIndex),
          values.ethAmount[0],
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Add Collateral"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="ETH Amount">
        <TextInput {...fieldsProps.ethAmount} />
      </FormField>
    </ContractAction>
  );
}

function WithdrawCollateral() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    ethAmount: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "withdrawColl",
        args: [
          getTroveId(account.address, values.ownerIndex),
          values.ethAmount[0],
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Withdraw Collateral"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="ETH Amount">
        <TextInput {...fieldsProps.ethAmount} />
      </FormField>
    </ContractAction>
  );
}

function AdjustTroveInterestRate() {
  const account = useAccount();
  const { writeContract, error, reset } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    newAnnualInterestRate: formValue(dn.from(0, 18), parseInputPercentage),
    upperHint: formValue(dn.from(0, 18), parseInputValue),
    lowerHint: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "adjustTroveInterestRate",
        args: [
          getTroveId(account.address, values.ownerIndex),
          values.newAnnualInterestRate[0],
          values.upperHint[0],
          values.lowerHint[0],
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Adjust Trove Interest Rate"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="New Annual Interest Rate">
        <TextInput {...fieldsProps.newAnnualInterestRate} />
      </FormField>
      <FormField label="Upper Hint">
        <TextInput {...fieldsProps.upperHint} />
      </FormField>
      <FormField label="Lower Hint">
        <TextInput {...fieldsProps.lowerHint} />
      </FormField>
    </ContractAction>
  );
}

function AdjustTrove() {
  const account = useAccount();
  const { error, reset, writeContract } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    maxFeePercentage: formValue(dn.from(0, 18), parseInputValue),
    collChange: formValue(dn.from(0, 18), parseInputValue),
    isCollIncrease: formValue(false, (value) => value === "true"),
    boldChange: formValue(dn.from(0, 18), parseInputValue),
    isDebtIncrease: formValue(false, (value) => value === "true"),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "adjustTrove",
        args: [
          getTroveId(account.address, values.ownerIndex),
          values.maxFeePercentage[0],
          values.collChange[0],
          values.isCollIncrease,
          values.boldChange[0],
          values.isDebtIncrease,
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Adjust Trove"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="Max Fee Percentage">
        <TextInput {...fieldsProps.maxFeePercentage} />
      </FormField>
      <FormField label="Coll Change">
        <TextInput {...fieldsProps.collChange} />
      </FormField>
      <FormField label="Is Coll Increase">
        <TextInput {...fieldsProps.isCollIncrease} />
      </FormField>
      <FormField label="BOLD Change">
        <TextInput {...fieldsProps.boldChange} />
      </FormField>
      <FormField label="Is Debt Increase">
        <TextInput {...fieldsProps.isDebtIncrease} />
      </FormField>
    </ContractAction>
  );
}

function WithdrawBold() {
  const account = useAccount();
  const { error, reset, writeContract } = useWriteContract();

  const { fieldsProps, values } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    maxFeePercentage: formValue(dn.from(0, 18), parseInputValue),
    boldAmount: formValue(dn.from(0, 18), parseInputValue),
  }), reset);

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        ...BorrowerOperationsContract,
        functionName: "withdrawBold",
        args: [
          getTroveId(account.address, values.ownerIndex),
          values.maxFeePercentage[0],
          values.boldAmount[0],
        ],
      });
    }
  };

  return (
    <ContractAction
      error={error}
      onSubmit={onSubmit}
      title="Withdraw BOLD"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="Max Fee Percentage">
        <TextInput {...fieldsProps.maxFeePercentage} />
      </FormField>
      <FormField label="BOLD Amount">
        <TextInput {...fieldsProps.boldAmount} />
      </FormField>
    </ContractAction>
  );
}
