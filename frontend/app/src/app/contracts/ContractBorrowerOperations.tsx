import { BorrowerOperationsContract } from "@/src/contracts";
import { formValue, parseInputInt, parseInputPercentage, parseInputValue, useForm } from "@/src/form-utils";
import { getTroveId, useCollTokenAllowance } from "@/src/liquity-utils";
import { FormField, TextInput } from "@liquity2/uikit";
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
  const writeOpenTrove = useWriteContract();

  const { fieldsProps, values, fill } = useForm(() => ({
    ownerIndex: formValue(0n, parseInputInt),
    maxFeePercentage: formValue(dn.from(0, 18), parseInputPercentage),
    ethAmount: formValue(dn.from(0, 18), parseInputValue),
    boldAmount: formValue(dn.from(0, 18), parseInputValue),
    upperHint: formValue(dn.from(0, 18), parseInputValue),
    lowerHint: formValue(dn.from(0, 18), parseInputValue),
    annualInterestRate: formValue(dn.from(0, 18), parseInputPercentage),
  }), writeOpenTrove.reset);

  const tokenAllowance = useCollTokenAllowance();
  const isApproved = (tokenAllowance.allowance.data ?? 0n) >= values.ethAmount[0];

  const onSubmit = () => {
    if (!account.address) {
      return;
    }

    if (!isApproved) {
      tokenAllowance.approve();
      return;
    }

    writeOpenTrove.writeContract({
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
  };

  const onFillExample = () => {
    fill({
      ownerIndex: "0",
      maxFeePercentage: "100",
      ethAmount: "20",
      boldAmount: "1800",
      upperHint: "0",
      lowerHint: "0",
      annualInterestRate: "5",
    });
  };

  return (
    <ContractAction
      buttonLabel={isApproved ? "Open Trove" : "Approve"}
      error={writeOpenTrove.error}
      onFillExample={onFillExample}
      onSubmit={onSubmit}
      title="Open Trove"
    >
      <FormField label="Owner Index">
        <TextInput {...fieldsProps.ownerIndex} />
      </FormField>
      <FormField label="WETH Amount">
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
      <FormField label="Max Fee Percentage">
        <TextInput {...fieldsProps.maxFeePercentage} />
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
