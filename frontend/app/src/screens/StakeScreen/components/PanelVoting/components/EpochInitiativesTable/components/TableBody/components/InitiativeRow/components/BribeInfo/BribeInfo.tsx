import { type Address, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import type { FC } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { CHAIN_ID } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { usePrice } from "@/src/services/Prices";
import { tokenIconUrl } from "@/src/utils";
import { css } from "@/styled-system/css";

interface BribeInfoProps {
  initiativeAddress: Address;
}

export const BribeInfo: FC<BribeInfoProps> = ({ initiativeAddress }) => {
  const { currentBribesData } = useVotingStateContext();
  const bribe = currentBribesData?.[initiativeAddress];
  const boldPrice = usePrice(bribe ? "BOLD" : null);
  const bribeTokenPrice = usePrice(bribe ? bribe.tokenSymbol : null);

  if (!bribe || (dn.eq(bribe.boldAmount, 0) && dn.eq(bribe.tokenAmount, 0))) {
    return null;
  }

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
      })}
      title="Available bribes for voting on this initiative"
    >
      <span>Bribing:</span>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
        })}
      >
        {dn.gt(bribe.boldAmount, 0) && (
          <div
            title={`${fmtnum(bribe.boldAmount)} JPYDF`}
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
            })}
          >
            <TokenIcon symbol="BOLD" size={12} title={null} />
            <Amount format="compact" title={null} value={bribe.boldAmount} />
            {boldPrice.data && (
              <Amount
                format="compact"
                title={null}
                prefix="($"
                value={dn.mul(bribe.boldAmount, boldPrice.data)}
                suffix=")"
              />
            )}
          </div>
        )}
        {dn.gt(bribe.tokenAmount, 0) && (
          <div
            title={`${fmtnum(bribe.tokenAmount)} ${bribe.tokenSymbol} (${bribe.tokenAddress})`}
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
            })}
          >
            <TokenIcon
              size={12}
              title={null}
              token={{
                icon: tokenIconUrl(CHAIN_ID, bribe.tokenAddress),
                name: bribe.tokenSymbol,
                symbol: bribe.tokenSymbol,
              }}
            />
            <Amount format="compact" title={null} value={bribe.tokenAmount} />
            {bribeTokenPrice.data && (
              <Amount
                format="compact"
                title={null}
                prefix="($"
                value={dn.mul(bribe.tokenAmount, bribeTokenPrice.data)}
                suffix=")"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
