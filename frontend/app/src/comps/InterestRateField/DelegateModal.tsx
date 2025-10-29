import type { Address, BranchId, Delegate } from "@/src/types";

import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import content from "@/src/content";
import { useKnownDelegates } from "@/src/liquity-delegate";
import { getBranch, useInterestBatchDelegate, useInterestBatchDelegates } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { AddressField, Modal } from "@liquity2/uikit";
import { useMemo, useState } from "react";
import { DelegateBox } from "./DelegateBox";

const URL_WHAT_IS_DELEGATION =
  "https://docs.liquity.org/v2-faq/redemptions-and-delegation#what-is-delegation-of-interest-rates";

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

  const knownDelegatesQuery = useKnownDelegates();

  const delegate = useInterestBatchDelegate(branchId, delegateAddress);

  const filteredStrategies = useMemo(() => {
    if (!knownDelegatesQuery || knownDelegatesQuery.status === "pending" || !knownDelegatesQuery.data) return [];
    const branch = getBranch(branchId);
    const branchSymbol = branch.symbol;
    const strategies: Array<{ groupName: string; strategy: any }> = [];
    knownDelegatesQuery.data.forEach((group) => {
      group.strategies.forEach((strategy) => {
        if (
          strategy.branches.some((branch) => branch.toLowerCase() === branchSymbol.toLowerCase()) &&
          !strategy.hide
        ) {
          strategies.push({
            groupName: group.name,
            strategy,
          });
        }
      });
    });
    return strategies;
  }, [branchId, knownDelegatesQuery?.data, knownDelegatesQuery?.status]);

  const searchFilteredStrategies = useMemo(() => {
    if (!delegateAddressValue.trim()) {
      return filteredStrategies;
    }

    const searchTerm = delegateAddressValue.toLowerCase();
    return filteredStrategies.filter(({ groupName, strategy }) => {
      const displayName = strategy.name ? groupName + " - " + strategy.name : groupName;
      return displayName.toLowerCase().includes(searchTerm)
        || strategy.address.toLowerCase().includes(searchTerm);
    });
  }, [filteredStrategies, delegateAddressValue]);

  const isSearchingAddress = useMemo(() => {
    const term = delegateAddressValue.trim();
    return term.startsWith("0x") && term.length >= 10;
  }, [delegateAddressValue]);

  const isCustomDelegate = useMemo(() => {
    if (!isSearchingAddress || !delegateAddress || !delegate.data) return false;
    return !searchFilteredStrategies.some(({ strategy }) =>
      strategy.address.toLowerCase() === delegateAddress.toLowerCase()
    );
  }, [isSearchingAddress, delegateAddress, delegate.data, searchFilteredStrategies]);

  const isKnownDelegateForOtherCollateral = useMemo(() => {
    if (!isSearchingAddress || !delegateAddress || !knownDelegatesQuery?.data) return false;

    const addressExists = knownDelegatesQuery.data.some((group) =>
      group.strategies.some((strategy) => strategy.address.toLowerCase() === delegateAddress.toLowerCase())
    );

    const existsForCurrentCollateral = searchFilteredStrategies.some(({ strategy }) =>
      strategy.address.toLowerCase() === delegateAddress.toLowerCase()
    );

    return addressExists && !existsForCurrentCollateral;
  }, [isSearchingAddress, delegateAddress, knownDelegatesQuery?.data, searchFilteredStrategies]);

  const delegateAddresses = useMemo(() => {
    return searchFilteredStrategies.map(({ strategy }) => strategy.address as Address);
  }, [searchFilteredStrategies]);

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
            placeholder="Search by name or address..."
            value={delegateAddressValue}
          />
        </form>

        <div
          className={css({
            fontSize: 18,
            fontWeight: 500,
            paddingTop: 32,
            paddingBottom: 16,
            color: "content",
          })}
        >
          Available Delegates
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          })}
        >
          {isCustomDelegate && delegate.data && (
            <div>
              <div
                className={css({
                  fontSize: 14,
                  color: "contentAlt",
                  marginBottom: "8px",
                  fontStyle: "italic",
                })}
              >
                Custom Delegate
              </div>
              <DelegateBox
                branchId={branchId}
                delegate={delegate.data}
                selectLabel="Choose"
                onSelect={onSelectDelegate}
              />
            </div>
          )}

          {isSearchingAddress && delegateAddress && !isCustomDelegate && (
            <div>
              {delegate.status === "pending"
                ? (
                  <div className={css({ color: "contentAlt", paddingTop: 40, textAlign: "center" })}>
                    Loading custom delegate...
                  </div>
                )
                : delegate.status === "error"
                ? (
                  <div className={css({ color: "contentAlt", paddingTop: 40, textAlign: "center" })}>
                    Invalid delegate address
                  </div>
                )
                : null}
            </div>
          )}

          {searchFilteredStrategies.length > 0 && isCustomDelegate && delegate.data && (
            <div
              className={css({
                fontSize: 14,
                color: "contentAlt",
                marginTop: "24px",
                marginBottom: "8px",
                fontStyle: "italic",
              })}
            >
              From Delegates List
            </div>
          )}

          {knownDelegatesQuery?.status === "pending"
            ? (
              <div
                className={css({
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "contentAlt",
                  fontSize: 16,
                })}
              >
                Loading delegates...
              </div>
            )
            : knownDelegatesQuery?.status === "error"
            ? (
              <div
                className={css({
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "contentAlt",
                  fontSize: 16,
                })}
              >
                Error loading delegates
              </div>
            )
            : searchFilteredStrategies.length === 0 && delegateAddressValue.trim() && !isCustomDelegate
            ? (
              <div
                className={css({
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "contentAlt",
                  fontSize: 16,
                })}
              >
                {isKnownDelegateForOtherCollateral
                  ? `This delegate (${delegateAddressValue}) does not support your Trove collateral. Choose a delegate for your collateral (${
                    getBranch(branchId).symbol
                  }).`
                  : `No delegates found matching "${delegateAddressValue}"`}
              </div>
            )
            : (
              searchFilteredStrategies.map(({ groupName, strategy }, index) => {
                const delegateAddress = strategy.address as Address;
                const delegateData = delegatesQuery.data?.find((d) =>
                  d.address.toLowerCase() === delegateAddress.toLowerCase()
                );

                const displayName = strategy.name ? groupName + " - " + strategy.name : groupName;

                return (
                  <div key={index}>
                    {delegatesQuery.status === "pending"
                      ? (
                        <div className={css({ color: "contentAlt", paddingTop: 40 })}>
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
                          url={knownDelegatesQuery?.data?.find((group) => group.name === groupName)?.url}
                        />
                      )
                      : (
                        <div className={css({ color: "contentAlt" })}>
                          No data available for {displayName}
                        </div>
                      )}
                  </div>
                );
              })
            )}
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
