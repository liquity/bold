import { css } from "@/styled-system/css";
import { gt, mul } from "dnum";
import { fmtnum } from "@/src/formatting";
import { Amount } from "@/src/comps/Amount/Amount";
import { tokenIconUrl } from "@/src/utils";
import { CHAIN_ID } from "@/src/env";
import { usePrice } from "@/src/services/Prices";
import { useVotingStateContext } from "@/src/screens/StakeScreen/components/PanelVoting/providers/PanelVotingProvider/hooks";
import { TokenIcon } from "@liquity2/uikit";

import type { FC } from "react";
import type { Address } from "@liquity2/uikit";

interface BribeInfoProps {
  initiativeAddress: Address;
}

export const BribeInfo: FC<BribeInfoProps> = ({ initiativeAddress }) => {
  const { currentBribesData } = useVotingStateContext();
  const bribe = currentBribesData?.[initiativeAddress];
  const boldPrice = usePrice(bribe ? "BOLD" : null);
  const bribeTokenPrice = usePrice(bribe ? bribe.tokenSymbol : null);

  if (!bribe || (gt(bribe.boldAmount, 0) && gt(bribe.tokenAmount, 0))) {
    return null;
  }

  const bribeTokenAmount = gt(bribe.tokenAmount, 0);

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
        {gt(bribe.boldAmount, 0) && (
          <div
            title={`${fmtnum(bribe.boldAmount)} BOLD`}
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
                value={mul(bribe.boldAmount, boldPrice.data)}
                suffix=")"
              />
            )}
          </div>
        )}
        {bribeTokenAmount && (
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
                value={mul(bribe.tokenAmount, bribeTokenPrice.data)}
                suffix=")"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
