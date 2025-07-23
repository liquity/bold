import { useState, ReactNode } from "react";
import { getRedemptionRisk } from "@/src/liquity-math";


import type { Address, CollIndex, Delegate } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import content from "@/src/content";
import { fmtnum, formatRedemptionRisk } from "@/src/formatting";
import { useInterestBatchDelegate } from "@/src/subgraph-hooks";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  AddressField,
  Button,
  IconCopy,
  Modal,
  StatusDot,
  TextButton,
} from "@liquity2/uikit";
import { MiniChart } from "./MiniChart";

const URL_WHAT_IS_DELEGATION =
  "https://docs.nerite.org/docs/user-docs/redemption-and-delegation#what-is-delegation-of-interest-rates";

// const DELEGATES_LIST_URL =
//   "https://docs.liquity.org/v2-faq/redemptions-and-delegation#docs-internal-guid-441d8c3f-7fff-4efa-6319-4ba00d908597";

function ShadowBox({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        width: "100%",
        background: "background",
        borderWidth: "1px 1px 0",
        borderStyle: "solid",
        borderColor: "gray:50",
        boxShadow: `
          0 2px 2px rgba(0, 0, 0, 0.1),
          0 4px 10px rgba(18, 27, 68, 0.05),
          inset 0 -1px 4px rgba(0, 0, 0, 0.05)
        `,
        borderRadius: 8,
      })}
    >
      {children}
    </div>
  );
}

function DelegateBox({
  delegate,
  onSelect,
  selectLabel = "Select",
}: {
  delegate: Delegate;
  onSelect: (delegate: Delegate) => void;
  selectLabel: string;
}) {
  const delegationRisk = getRedemptionRisk(delegate.interestRate);
  return (
    <ShadowBox key={delegate.id}>
      <section
        key={delegate.name}
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 16px",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.borderSoft)",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              fontSize: 20,
              fontWeight: 500,
              userSelect: "none",
            })}
          >
            <h1 title={`${delegate.name} (${delegate.address})`}>
              {delegate.name}
            </h1>
            <div
              className={css({
                display: "flex",
                gap: 6,
                alignItems: "center",
              })}
            >
              <MiniChart />
              {fmtnum(delegate.interestRate, "pct1z")}%
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "center",
              })}
            >
              <Amount
                value={delegate.boldAmount}
                format='compact'
                suffix=' USND'
              />
            </div>
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "center",
              })}
            >
              <StatusDot mode={riskLevelToStatusMode(delegationRisk)} />
              {formatRedemptionRisk(delegationRisk)}
            </div>
          </div>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            paddingTop: 12,
            fontSize: 14,
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.borderSoft)",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div>Interest rate range</div>
            <div>
              {fmtnum(delegate.interestRateChange[0], "pct2")}
              <span>-</span>
              {fmtnum(delegate.interestRateChange[1], "pct2")}%
            </div>
          </div>
          {delegate.fee && (
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                fontSize: 14,
                color: "content",
              })}
            >
              <div>
                Fees <abbr title='per annum'>p.a.</abbr>
              </div>
              <div title={`${fmtnum(delegate.fee, "pctfull")}%`}>
                {fmtnum(delegate.fee, { digits: 4, scale: 100 })}%
              </div>
            </div>
          )}
        </div>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 16,
            paddingBottom: 8,
            fontSize: 14,
          })}
        >
          <div
            className={css({
              display: "flex",
              gap: 8,
            })}
          >
            <TextButton
              label={
                <>
                  Copy address
                  <IconCopy size={16} />
                </>
              }
              className={css({
                fontSize: 14,
              })}
            />
          </div>
          <div>
            <Button
              label={selectLabel}
              mode='primary'
              size='small'
              onClick={() => {
                onSelect(delegate);
              }}
            />
          </div>
        </div>
      </section>
    </ShadowBox>
  );
}

export function DelegateModal({
  branchId,
  onClose,
  onSelectDelegate,
  visible,
}: {
  branchId: CollIndex;
  onClose: () => void;
  onSelectDelegate: (delegate: Delegate) => void;
  visible: boolean;
}) {
  const [delegateAddress, setDelegateAddress] = useState<null | Address>(null);
  const [delegateAddressValue, setDelegateAddressValue] = useState("");

  const delegate = useInterestBatchDelegate(branchId, delegateAddress);

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

              {/* <div>
                Delegate addresses can be found{"  "}
                <LinkTextButton
                  label="here"
                  href={DELEGATES_LIST_URL}
                  external
                />.
              </div> */}
            </>
          )}
      </div>
    </Modal>
  );
}
