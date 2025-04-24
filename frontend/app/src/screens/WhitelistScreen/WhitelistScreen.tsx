"use client";

import { css } from "@/styled-system/css";
import { isWhitelistedUser } from "@/src/liquity-utils";
import { Field } from "@/src/comps/Field/Field";
import { Address, Button, InputField, TokenIcon } from "@liquity2/uikit";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { Screen } from "@/src/comps/Screen/Screen";
import { useState } from "react";
import { useAccount } from "wagmi";
import { zeroAddress } from "viem";
import { getBranchContract } from "@/src/contracts";

export function WhitelistScreen() {
  const txFlow = useTransactionFlow();
  const account = useAccount();

  // const whitelist = getBranchContract("WETH", "Whitelist");

  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [user, setUser] = useState<Address>();
  const [callingContract, setCallingContract] = useState<Address>();

  const checkWhitelist = isWhitelistedUser(
    "0xc9ec9ade0f65d3aa1e4bf6f23fe31ad95d3ea00e",
    callingContract,
    user
  );

  const handleCheckWhitelist = () => {
    setIsWhitelisted(checkWhitelist);
  };

  const handleUser = (value) => {
    setUser(value);
  };
  const handleContract = (value) => {
    setCallingContract(value);
  };

  return (
    <Screen
      heading={{
        title: "Add to Whitelist",
        subtitle:
          "You can adjust your loans, including your interest rate at any time",
      }}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
          width: 534,
        })}
      >
        <Field
          field={
            <InputField
              id="input-user"
              label="User"
              labelHeight={10}
              onChange={handleUser}
              value={user}
              placeholder="0x"
            />
          }
        />

        <Field
          field={
            <InputField
              id="input-user"
              label="Whitelisting contracts"
              labelHeight={10}
              onChange={handleContract}
              value={callingContract}
              placeholder="0x"
            />
          }
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            width: "100%",
          }}
        >
          <Button
            label={"Check User Whitelist Status"}
            mode="primary"
            size="medium"
            shape="rectangular"
            wide
            onClick={handleCheckWhitelist}
          />
          {`User is whitelisted: ${isWhitelisted}`}
          <Button
            label={"Add to whitelist"}
            mode="primary"
            size="medium"
            shape="rectangular"
            wide
            onClick={() => {
              txFlow.start({
                flowId: "addToWhitelist",
                backLink: [`/whitelist`, "Back to overview"],
                successLink: ["/whitelist", "Go to the Owner page"],
                successMessage: "Added user",
                whitelist: "0xc9ec9ade0f65d3aa1e4bf6f23fe31ad95d3ea00e",
                callingContract,
                user,
              });
            }}
          />
          <Button
            label={"Remove from whitelist"}
            mode="primary"
            size="medium"
            shape="rectangular"
            wide
            onClick={() => {
              txFlow.start({
                flowId: "removeFromWhitelist",
                backLink: [`/whitelist`, "Back to overview"],
                successLink: ["/whitelist", "Go to the Owner page"],
                successMessage: "Added user",
                whitelist: "0xc9ec9ade0f65d3aa1e4bf6f23fe31ad95d3ea00e",
                callingContract,
                user,
              });
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
