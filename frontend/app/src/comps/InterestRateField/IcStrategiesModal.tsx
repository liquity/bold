import type { BranchId, Delegate } from "@/src/types";

import content from "@/src/content";
import { getBranch, useInterestBatchDelegates } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { Modal, TextButton } from "@liquity2/uikit";
import Image from "next/image";
import { useState } from "react";
import { DelegateBox } from "./DelegateBox";
import { ShadowBox } from "./ShadowBox";

import icLogo from "./ic-logo.svg";

export function IcStrategiesModal({
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
  const [displayedDelegates, setDisplayedDelegates] = useState(5);

  const branch = getBranch(branchId);
  const delegates = useInterestBatchDelegates(branchId, branch.strategies.map((s) => s.address));
  const icpDelegates = delegates.data?.map((delegate, index) => ({
    ...delegate,
    name: branch.strategies[index]?.name ?? delegate.address,
  }));

  return (
    <Modal
      onClose={onClose}
      title={
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 10,
          })}
        >
          <div>{content.interestRateField.icStrategyModal.title}</div>
          <Image
            alt=""
            src={icLogo}
            width={24}
            height={24}
          />
        </div>
      }
      visible={visible}
    >
      <div
        className={css({
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {content.interestRateField.icStrategyModal.intro}
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: 32,
        })}
      >
        {icpDelegates?.slice(0, displayedDelegates).map((delegate) => {
          return (
            <DelegateBox
              key={delegate.address}
              branchId={branchId}
              delegate={delegate}
              selectLabel="Choose"
              onSelect={onSelectDelegate}
            />
          );
        })}
        {displayedDelegates < branch.strategies.length && (
          <ShadowBox>
            <TextButton
              label="Load more"
              onClick={() => setDisplayedDelegates(displayedDelegates + 5)}
              className={css({
                width: "100%",
                padding: "24px 0",
                justifyContent: "center",
              })}
            />
          </ShadowBox>
        )}
      </div>
    </Modal>
  );
}
