"use client";

import { css } from "@/styled-system/css";
import {
  getBranch,
  getBranches,
  getCollToken,
  useIsWhitelistedUser,
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
import { getBranchContract } from "@/src/contracts";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { zeroAddress } from "viem";

export function WhitelistScreen() {
  const txFlow = useTransactionFlow();
  const account = useAccount();
  const router = useRouter();

  const branches = getBranches();

  const [collSymbol, setCollSymbol] = useState<string>(branches[0]?.symbol);
  const [contractIndex, setContractIndex] = useState<number>(0);

  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }
  
  const addressesRegistry = getBranchContract(collSymbol, "AddressesRegistry");
  const owner = useProtocolOwner(addressesRegistry.address);

  console.log("OWNER", owner);

  const collaterals = branches.map((b) => getCollToken(b.branchId));

  const protocolContractsFilter = [
    "BorrowerOperations",
    "StabilityPool",
    "TroveManager",
    "TroveNFT",
  ]; // contracts that require whitelisting
  const branch = getBranch(collSymbol);
  const branchContractNames = Object.keys(branch.contracts).filter((name) =>
    protocolContractsFilter.includes(name)
  );

  const whitelist = getBranchContract(branch.branchId, "Whitelist");

  const [user, setUser] = useState<Address>();
  const [whitelistedContract, setWhitelistedContract] = useState<Address>(
    branch.contracts[branchContractNames[0]].address
  );
  const [showPage, setShowPage] = useState<boolean>(false);

  const disableWhitelist = whitelist.address == zeroAddress;
  const disableButton =
    disableWhitelist || whitelistedContract == zeroAddress || user == undefined;

  const isWhitelistedUser = useIsWhitelistedUser(
    whitelist.address,
    whitelistedContract,
    user
  );

  useEffect(() => {
    if (owner !== undefined) {
      if (owner === account.address)
        setShowPage(true);
      else {
        setShowPage(false);
        router.push("/");
      }
    }
  }, [account]);

  const handleUser = (value) => {
    setUser(value);
  };

  return (
    <>
      {owner && collaterals && showPage && (
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
                  items={branchContractNames.map((contract) => ({
                    icon: <></>,
                    label: contract,
                  }))}
                  menuPlacement="end"
                  menuWidth={600}
                  onSelect={(index) => {
                    setContractIndex(index);
                    setWhitelistedContract(
                      branch.contracts[branchContractNames[index]].address
                    );
                  }}
                  selected={contractIndex}
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

            {`Whitelist Contract Address: ${whitelist.address}`}
            {user && (
              <WhitelistStatus
                user={user}
                isWhitelistedUser={isWhitelistedUser}
                contractName={branchContractNames[contractIndex]}
              />
            )}

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
                disabled={disableButton || isWhitelistedUser}
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
                    callingContract: whitelistedContract,
                    user,
                  });
                }}
              />
              <Button
                disabled={disableButton || !isWhitelistedUser}
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
                    callingContract: whitelistedContract,
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

export function WhitelistStatus({ user, isWhitelistedUser, contractName }) {
  let statusMessage = `User ${user} `;
  let statusColor;

  if (isWhitelistedUser === true) {
    statusMessage = statusMessage.concat(
      `is whitelisted to transact with the ${contractName} contract`
    );
    statusColor = "green";
  } else if (isWhitelistedUser === false) {
    statusMessage = statusMessage.concat(
      `is NOT whitelisted to transact with the ${contractName} contract`
    );
    statusColor = "red";
  } else {
    statusMessage = "Invalid User";
  }

  return (
    <>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          color: "white",
          marginTop: "10px",
        }}
      >
        USER WHITELIST STATUS
        <p style={{ fontSize: "1rem", fontWeight: "bold", color: statusColor }}>
          {statusMessage}
        </p>
      </div>
    </>
  );
}
