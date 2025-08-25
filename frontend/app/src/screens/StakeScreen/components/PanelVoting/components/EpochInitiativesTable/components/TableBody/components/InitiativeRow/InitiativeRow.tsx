import { css } from "@/styled-system/css";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { isInitiativeStatusActive } from "@/src/screens/StakeScreen/utils";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { InitiativeStatusTag } from "./components/InitiativeStatusTag";
import { shortenAddress, IconExternal } from "@liquity2/uikit";
import { BribeInfo } from "./components/BribeInfo";
import { Voting } from "./components/Voting";
import { AmountPresentation } from "./components/AmountPresentation";

import type { Initiative } from "@/src/types";
import type { FC } from "react";

interface InitiativeRowProps {
  initiative: Initiative;
}
export const InitiativeRow: FC<InitiativeRowProps> = ({ initiative }) => {
  const { initiativesStatesData } = useVotingStateContext();

  const initiativesStatus = initiativesStatesData?.[initiative.address]?.status;
  const isStatusActive = isInitiativeStatusActive(
    initiativesStatus ?? "nonexistent",
  );
  const disabled = !isStatusActive;

  return (
    <tr>
      <td>
        <div
          className={css({
            display: "grid",
          })}
        >
          <div
            title={initiative.address}
            className={css({
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              paddingTop: 6,
              gap: 4,
            })}
          >
            <div
              className={css({
                minWidth: 0,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
              })}
            >
              {initiative.url ? (
                <LinkTextButton
                  external
                  href={initiative.url}
                  label={
                    <>
                      {initiative.name ?? "Initiative"}
                      <IconExternal size={16} />
                    </>
                  }
                />
              ) : (
                (initiative.name ?? "Initiative")
              )}
            </div>
            <InitiativeStatusTag
              initiativesStatus={initiativesStatus}
              isStatusActive={isStatusActive}
            />
          </div>
          <div>
            <LinkTextButton
              external
              href={`${CHAIN_BLOCK_EXPLORER?.url}address/${initiative.address}`}
              title={initiative.address}
              label={
                initiative.protocol ?? shortenAddress(initiative.address, 4)
              }
              className={css({
                fontSize: 12,
                color: "contentAlt!",
              })}
            />
          </div>

          <AmountPresentation initiativeAddress={initiative.address} />

          <BribeInfo initiativeAddress={initiative.address} />
        </div>
      </td>
      <td>
        <Voting initiativeAddress={initiative.address} disabled={disabled} />
      </td>
    </tr>
  );
};
