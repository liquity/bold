import type { Dnum } from "dnum";

import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { FormField } from "@/src/comps/FormField/FormField";
import { TextInput } from "@/src/comps/Input/TextInput";
import { CONTRACT_BORROWER_OPERATIONS } from "@/src/env";
import { parseInputInt, parseInputPercentage, parseInputValue } from "@/src/form-utils";
import { getTroveId } from "@/src/liquity-utils";
import * as dn from "dnum";
import { useState } from "react";
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

type FormValue<T> = [fieldValue: string, parsedValue: T];

function OpenTrove() {
  const account = useAccount();
  const { writeContract } = useWriteContract();

  const [formValues, setFormValues] = useState<{
    ownerIndex: FormValue<bigint>;
    maxFeePercentage: FormValue<Dnum>;
    boldAmount: FormValue<Dnum>;
    upperHint: FormValue<Dnum>;
    lowerHint: FormValue<Dnum>;
    annualInterestRate: FormValue<Dnum>;
    ethAmount: FormValue<Dnum>;
  }>(() => ({
    ownerIndex: ["", 0n],
    maxFeePercentage: ["", dn.from(0, 18)],
    boldAmount: ["", dn.from(0, 18)],
    upperHint: ["", dn.from(0, 18)],
    lowerHint: ["", dn.from(0, 18)],
    annualInterestRate: ["", dn.from(0, 18)],
    ethAmount: ["", dn.from(0, 18)],
  }));

  const formProps = Object.fromEntries([
    ["ownerIndex", parseInputInt] as const,
    ["maxFeePercentage", parseInputValue] as const,
    ["boldAmount", parseInputValue] as const,
    ["upperHint", parseInputValue] as const,
    ["lowerHint", parseInputValue] as const,
    ["annualInterestRate", parseInputPercentage] as const,
    ["ethAmount", parseInputValue] as const,
  ].map(([name, valueParser]) => [name, {
    onChange: (value: string) => {
      const parsedValue = valueParser(value);
      if (parsedValue !== null) {
        setFormValues((values) => ({
          ...values,
          [name]: [value, parsedValue],
        }));
      }
    },
    value: formValues[name][0],
  }]));

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        abi: BorrowerOperations,
        address: CONTRACT_BORROWER_OPERATIONS,
        functionName: "openTrove",
        args: [
          account.address,
          formValues.ownerIndex[1],
          formValues.maxFeePercentage[1][0],
          formValues.ethAmount[1][0],
          formValues.boldAmount[1][0],
          formValues.upperHint[1][0],
          formValues.lowerHint[1][0],
          formValues.annualInterestRate[1][0],
        ],
      });
    }
  };

  const onFillExample = () => {
    setFormValues({
      ownerIndex: ["0", 0n],
      maxFeePercentage: ["100", [100n * 10n ** 16n, 18]],
      boldAmount: ["1800", [1800n * 10n ** 18n, 18]],
      upperHint: ["0", [0n, 18]],
      lowerHint: ["0", [0n, 18]],
      annualInterestRate: ["5", [5n * 10n ** 16n, 18]],
      ethAmount: ["20", [20n * 10n ** 18n, 18]],
    });
  };

  return (
    <ContractAction
      onFillExample={onFillExample}
      onSubmit={onSubmit}
      title="Open Trove"
    >
      <FormField label="Owner Index">
        <TextInput {...formProps.ownerIndex} />
      </FormField>
      <FormField label="Max Fee Percentage">
        <TextInput {...formProps.maxFeePercentage} />
      </FormField>
      <FormField label="ETH Amount">
        <TextInput {...formProps.ethAmount} />
      </FormField>
      <FormField label="BOLD Amount">
        <TextInput {...formProps.boldAmount} />
      </FormField>
      <FormField label="Upper Hint">
        <TextInput {...formProps.upperHint} />
      </FormField>
      <FormField label="Lower Hint">
        <TextInput {...formProps.lowerHint} />
      </FormField>
      <FormField label="Annual Interest Rate">
        <TextInput {...formProps.annualInterestRate} />
      </FormField>
    </ContractAction>
  );
}

function CloseTrove() {
  const account = useAccount();
  const { writeContract } = useWriteContract();

  const [formValues, setFormValues] = useState<{
    ownerIndex: FormValue<bigint>;
  }>(() => ({
    ownerIndex: ["", 0n],
  }));

  const formProps = Object.fromEntries([
    ["ownerIndex", parseInputInt] as const,
  ].map(([name, valueParser]) => [name, {
    onChange: (value: string) => {
      const parsedValue = valueParser(value);
      if (parsedValue !== null) {
        setFormValues((values) => ({
          ...values,
          [name]: [value, parsedValue],
        }));
      }
    },
    value: formValues[name][0],
  }]));

  const onSubmit = () => {
    if (account.address) {
      writeContract({
        abi: BorrowerOperations,
        address: CONTRACT_BORROWER_OPERATIONS,
        functionName: "closeTrove",
        args: [
          getTroveId(account.address, formValues.ownerIndex[1]),
        ],
      });
    }
  };

  return (
    <ContractAction
      title="Close Trove"
      onSubmit={onSubmit}
    >
      <FormField label="Owner Index">
        <TextInput {...formProps.ownerIndex} />
      </FormField>
    </ContractAction>
  );
}

function AdjustTroveInterestRate() {
  return (
    <ContractAction title="Adjust Trove Interest Rate">
      <FormField label="New Annual Interest Rate">
        <TextInput />
      </FormField>
      <FormField label="Upper Hint">
        <TextInput />
      </FormField>
      <FormField label="Lower Hint">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}

function AdjustTrove() {
  return (
    <ContractAction title="Adjust Trove">
      <FormField label="Max Fee Percentage">
        <TextInput />
      </FormField>
      <FormField label="Collateral withdrawal">
        <TextInput />
      </FormField>
      <FormField label="BOLD Amount">
        <TextInput />
      </FormField>
      <FormField label="Is Debt Increase">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}

function RepayBold() {
  const account = useAccount();
  const { writeContract } = useWriteContract();
  const [[boldAmountInput, boldAmount], setBoldAmount] = useState<[string, Dnum]>(["", dn.from(0, 18)]);
  return (
    <ContractAction
      title="Repay BOLD"
      onSubmit={() => {
        if (account.address) {
          writeContract({
            abi: BorrowerOperations,
            address: CONTRACT_BORROWER_OPERATIONS,
            functionName: "repayBold",
            args: [boldAmount[0]],
          });
        }
      }}
    >
      <FormField label="BOLD Amount">
        <TextInput
          onChange={(value) => {
            const parsedValue = parseInputValue(value);
            if (parsedValue !== null) {
              setBoldAmount([value, parsedValue]);
            }
          }}
          value={boldAmountInput}
        />
      </FormField>
    </ContractAction>
  );
}

function AddCollateral() {
  return (
    <ContractAction title="Add Collateral">
      <FormField label="ETH Amount">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}

function WithdrawCollateral() {
  return (
    <ContractAction title="Withdraw Collateral">
      <FormField label="ETH Amount">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}

function WithdrawBold() {
  return (
    <ContractAction title="Withdraw BOLD">
      <FormField label="Max Fee Percentage">
        <TextInput />
      </FormField>
      <FormField label="BOLD Amount">
        <TextInput />
      </FormField>
    </ContractAction>
  );
}
