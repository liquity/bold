import type { Address, BranchId, Delegate } from "@/src/types";

import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import content from "@/src/content";
import delegatesList from "@/src/delegateslist.json";
import { getBranch, useInterestBatchDelegate, useInterestBatchDelegates } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { AddressField, Modal } from "@liquity2/uikit";
import { useMemo, useState } from "react";
import { DelegateBox } from "./DelegateBox";

const URL_WHAT_IS_DELEGATION =
  "https://docs.liquity.org/v2-faq/redemptions-and-delegation#what-is-delegation-of-interest-rates";

const DELEGATES_LIST_URL =
  "https://docs.liquity.org/v2-faq/redemptions-and-delegation#docs-internal-guid-441d8c3f-7fff-4efa-6319-4ba00d908597";

export function DelegateModal({
  branchId,
  onClose,
  onSelectDelegate,
  visible,
}: {
  branchId: BranchId;
  onClose: () => void;
  onSelectDelegate: (delegate: Delegate) => void;
  visible: boolean;
}) {
  const [delegateAddress, setDelegateAddress] = useState<null | Address>(null);
  const [delegateAddressValue, setDelegateAddressValue] = useState("");

  const delegate = useInterestBatchDelegate(branchId, delegateAddress);

  const filteredStrategies = useMemo(() => {
    const branch = getBranch(branchId);
    const branchSymbol = branch.symbol;
    const strategies: Array<{ groupName: string; strategy: any }> = [];
    delegatesList.forEach((group) => {
      group.strategies.forEach((strategy) => {
        if (strategy.branches.some((branch) => branch.toLowerCase() === branchSymbol.toLowerCase())) {
          strategies.push({
            groupName: group.name,
            strategy,
          });
        }
      });
    });
    return strategies;
  }, [branchId]);

  const delegateAddresses = useMemo(() => {
    return filteredStrategies.map(({ strategy }) => strategy.address as Address);
  }, [filteredStrategies]);

  const delegatesQuery = useInterestBatchDelegates(branchId, delegateAddresses);

  return (
    <Modal
      onClose={onClose}
      title={content.interestRateField.delegatesModal.title}
      visible={visible}
    >
      <div
        className={css({
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {content.interestRateField.delegatesModal.intro}
      </div>
      <div
        className={css({
          paddingTop: 40,
        })}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (delegate.data) {
              onSelectDelegate(delegate.data);
            }
          }}
        >
          <AddressField
            onAddressChange={setDelegateAddress}
            onChange={setDelegateAddressValue}
            placeholder="Enter delegate address"
            value={delegateAddressValue}
          />
        </form>
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: 32,
          paddingBottom: 24,
          minHeight: 312,
        })}
      >
        {delegateAddress
          ? (
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                height: "100%",
              })}
            >
              {delegate.status === "pending"
                ? (
                  <div
                    className={css({
                      color: "contentAlt",
                      paddingTop: 40,
                    })}
                  >
                    Loading…
                  </div>
                )
                : delegate.status === "error"
                ? (
                  <div
                    className={css({
                      color: "contentAlt",
                      paddingTop: 40,
                    })}
                  >
                    Error: {delegate.error?.name}
                  </div>
                )
                : (
                  delegate.data
                    ? (
                      <DelegateBox
                        branchId={branchId}
                        delegate={delegate.data}
                        selectLabel="Choose"
                        onSelect={onSelectDelegate}
                      />
                    )
                    : (
                      <div>
                        The address is not a valid{" "}
                        <LinkTextButton
                          label="delegate"
                          href={URL_WHAT_IS_DELEGATION}
                          external
                        />.
                      </div>
                    )
                )}
            </div>
          )
          : (
            <>
              <div>
                Set a valid{" "}
                <LinkTextButton
                  label="delegate"
                  href={URL_WHAT_IS_DELEGATION}
                  external
                />{" "}
                address.
              </div>

              <div>
                Delegate addresses can be found{"  "}
                <LinkTextButton
                  label="here"
                  href={DELEGATES_LIST_URL}
                  external
                />.
              </div>
            </>
          )}
      </div>
      <div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          })}
        >
          {filteredStrategies.map(({ groupName, strategy }, index) => {
            const delegateAddress = strategy.address as Address;
            const delegateData = delegatesQuery.data?.find((d) =>
              d.address.toLowerCase() === delegateAddress.toLowerCase()
            );

            const displayName = strategy.name ? groupName + " - " + strategy.name : groupName;

            return (
              <div key={index}>
                {delegatesQuery.status === "pending"
                  ? (
                    <div
                      className={css({
                        color: "contentAlt",
                        paddingTop: 40,
                      })}
                    >
                      Loading…
                    </div>
                  )
                  : delegatesQuery.status === "error"
                  ? (
                    <div className={css({ color: "contentAlt", paddingTop: 40 })}>
                      Error: {delegatesQuery.error?.name}
                    </div>
                  )
                  : delegateData
                  ? (
                    <DelegateBox
                      branchId={branchId}
                      delegate={{
                        ...delegateData,
                        name: displayName,
                      }}
                      selectLabel="Choose"
                      onSelect={onSelectDelegate}
                    />
                  )
                  : (
                    <div className={css({ color: "contentAlt" })}>
                      No data available for {displayName}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: 32,
          paddingBottom: 24,
        })}
      >
        <div
          className={css({
            marginTop: "16px",
          })}
        >
          <LinkTextButton
            label="What is delegation?"
            href={URL_WHAT_IS_DELEGATION}
            external
          />
        </div>
      </div>
    </Modal>
  );
}
