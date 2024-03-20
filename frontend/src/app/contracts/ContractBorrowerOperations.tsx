import type { Address } from "@/src/types";
import type { Dnum } from "dnum";

import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { FormField } from "@/src/comps/FormField/FormField";
import { TextInput } from "@/src/comps/Input/TextInput";
import { CONTRACT_BORROWER_OPERATIONS } from "@/src/env";
import { ADDRESS_ZERO } from "@/src/eth-utils";
import { parseInputAddress, parseInputPercentage, parseInputValue } from "@/src/form-utils";
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

function OpenTrove() {
  const account = useAccount();
  const { writeContract } = useWriteContract();

  const [formValues, setFormValues] = useState<{
    maxFeePercentage: [string, Dnum];
    boldAmount: [string, Dnum];
    upperHint: [string, Address];
    lowerHint: [string, Address];
    annualInterestRate: [string, Dnum];
    ethValue: [string, Dnum];
  }>(() => ({
    maxFeePercentage: ["", dn.from(0, 18)],
    boldAmount: ["", dn.from(0, 18)],
    upperHint: ["", ADDRESS_ZERO],
    lowerHint: ["", ADDRESS_ZERO],
    annualInterestRate: ["", dn.from(0, 18)],
    ethValue: ["", dn.from(0, 18)],
  }));

  const formProps = Object.fromEntries([
    ["maxFeePercentage", parseInputValue] as const,
    ["boldAmount", parseInputValue] as const,
    ["upperHint", parseInputAddress] as const,
    ["lowerHint", parseInputAddress] as const,
    ["annualInterestRate", parseInputPercentage] as const,
    ["ethValue", parseInputValue] as const,
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
          formValues.maxFeePercentage[1][0],
          formValues.boldAmount[1][0],
          formValues.upperHint[1],
          formValues.lowerHint[1],
          formValues.annualInterestRate[1][0],
        ],
        value: formValues.ethValue[1][0],
      });
    }
  };

  const onFillExample = () => {
    const address = account.address ?? ADDRESS_ZERO;
    setFormValues({
      maxFeePercentage: ["100", [100n * 10n ** 16n, 18]],
      boldAmount: ["1800", [1800n * 10n ** 18n, 18]],
      upperHint: [address, address],
      lowerHint: [address, address],
      annualInterestRate: ["5", [5n * 10n ** 16n, 18]],
      ethValue: ["20", [20n * 10n ** 18n, 18]],
    });
  };

  return (
    <ContractAction
      onFillExample={onFillExample}
      onSubmit={onSubmit}
      title="Open Trove"
    >
      <FormField label="Max Fee Percentage">
        <TextInput {...formProps.maxFeePercentage} />
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
      <FormField label="Collateral (value)">
        <TextInput {...formProps.ethValue} />
      </FormField>
    </ContractAction>
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
