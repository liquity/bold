"use client";

import { css } from "@/styled-system/css";
import {
  getBranch,
  getBranches,
  getCollToken,
  isWhitelistedUser,
  useProtocolOwner,
} from "@/src/liquity-utils";
import { Field } from "@/src/comps/Field/Field";
import {
  Address,
  Button,
  Dropdown,
  InputField,
  isCollateralSymbol,
  TokenIcon,
} from "@liquity2/uikit";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { Screen } from "@/src/comps/Screen/Screen";
import { useState } from "react";
import { useAccount } from "wagmi";
import { getBranchContract, getProtocolContract } from "@/src/contracts";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { zeroAddress } from "viem";

export function WhitelistScreen() {
  const txFlow = useTransactionFlow();
  const account = useAccount();
  const router = useRouter();

  const addressesRegistry = getProtocolContract("AddressesRegistry");
  const owner = useProtocolOwner(addressesRegistry.address);

  const branches = getBranches();
  const [collSymbol, setCollSymbol] = useState<string>(branches[0]?.symbol);
  const [whitelistContract, setWhitelistContract] = useState<number>(0);

  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const collaterals = branches.map((b) => getCollToken(b.branchId));

  const branch = getBranch(collSymbol);
  const branchNames = Object.keys(branch.contracts);

  const whitelist = getBranchContract(branch.branchId, "Whitelist");

  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
  const [user, setUser] = useState<Address>();
  const [callingContract, setCallingContract] = useState<Address>(
    branch.contracts[branchNames[0]].address
  );
  const [showPage, setShowPage] = useState<boolean>(false);

  const disableWhitelist = whitelist.address == zeroAddress;
  const disableButton =
    disableWhitelist || callingContract == zeroAddress || user == undefined;

  const checkWhitelist = isWhitelistedUser(
    whitelist.address,
    callingContract,
    user
  );

  useEffect(() => {
    if (owner === account.address) {
      if (owner !== undefined) setShowPage(true);
    } else {
      setShowPage(false);
      router.push("/");
    }
  }, [account]);

  const handleCheckWhitelist = () => {
    setIsWhitelisted(checkWhitelist);
  };

  const handleUser = (value) => {
    setUser(value);
  };

  return (
    <>
      {showPage && (
        <Screen
          heading={{
            title: "Admin Page",
            subtitle: "Add and remove whitelist privileges to users",
          }}
        >
          <div
            className={css({
              maxWidth: 540,
              textAlign: "left",
            })}
          >
            Select Collateral Branch
            <Dropdown
              items={collaterals.map(({ symbol, name }) => ({
                icon: <TokenIcon symbol={symbol} />,
                label: name,
              }))}
              menuPlacement="end"
              menuWidth={400}
              onSelect={(index) => {
                const coll = collaterals[index];
                if (!coll) {
                  throw new Error(`Unknown branch: ${index}`);
                }
                setCollSymbol(coll.symbol);
              }}
              selected={branch.id}
            />
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 48,
              width: 534,
            })}
          >
            {!disableWhitelist && (
              <div
                className={css({
                  maxWidth: 540,
                  textAlign: "left",
                })}
              >
                Select Branch Contract to Whitelist
                <Dropdown
                  items={branchNames.map((contract) => ({
                    icon: <></>,
                    label: contract,
                  }))}
                  menuPlacement="end"
                  menuWidth={600}
                  onSelect={(index) => {
                    setWhitelistContract(index);
                    setCallingContract(
                      branch.contracts[branchNames[index]].address
                    );
                  }}
                  selected={whitelistContract}
                />
              </div>
            )}

            <Field
              field={
                <InputField
                  disabled={disableWhitelist}
                  id="input-user"
                  label="User"
                  labelHeight={20}
                  onChange={handleUser}
                  value={user}
                  placeholder="0x"
                />
              }
            />

            {`Whitelist: ${whitelist.address}`}
            <br></br>
            {`User is whitelisted: ${isWhitelisted}`}

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
                disabled={disableButton}
                label={"Check User Whitelist Status"}
                mode="primary"
                size="medium"
                shape="rectangular"
                wide
                onClick={handleCheckWhitelist}
              />
              <Button
                disabled={disableButton}
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
                    whitelist: whitelist.address,
                    callingContract,
                    user,
                  });
                }}
              />
              <Button
                disabled={disableButton}
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
                    whitelist: whitelist.address,
                    callingContract,
                    user,
                  });
                }}
              />
            </div>
          </div>
        </Screen>
      )}
    </>
  );
}
