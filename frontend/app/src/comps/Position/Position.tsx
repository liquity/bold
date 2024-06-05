import type { TroveId } from "@/src/types";

import { ACCOUNT_POSITIONS } from "@/src/demo-data";
import { css } from "@/styled-system/css";
import { Button, HFlex, InfoTooltip, StatusDot, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

export function Position({
  troveId,
}: {
  troveId: TroveId;
}) {
  const position = ACCOUNT_POSITIONS.find((position) => (
    position.type === "loan" && position.troveId === troveId
  ));
  return position && position.type === "loan" && (
    <section
      className={css({
        padding: "16px 16px 24px",
        color: "strongSurfaceContent",
        background: "strongSurface",
        borderRadius: 8,
      })}
    >
      <h1
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingBottom: 12,
          color: "strongSurfaceContentAlt",
        })}
      >
        <span>Total loan</span>
        <InfoTooltip heading="Total loan">
          The total amount of BOLD borrowed in this position.
        </InfoTooltip>
      </h1>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        })}
      >
        <div
          title={`${dn.format(position.borrowed)} BOLD`}
          className={css({
            display: "flex",
            alignItems: "center",
            fontSize: 40,
            lineHeight: 1,
            gap: 12,
          })}
        >
          <div>
            {dn.format(position.borrowed, {
              digits: 2,
            })}
          </div>
          <TokenIcon symbol="BOLD" size={32} />
        </div>
        <div>
          <Button label="Show details" />
        </div>
      </div>
      <div
        className={css({
          display: "grid",
          paddingTop: 28,
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        })}
      >
        <HFlex gap={8} justifyContent="flex-start">
          <div
            className={css({
              color: "strongSurfaceContentAlt",
            })}
          >
            LTV
          </div>
          <div>
            {dn.format(dn.mul(position.ltv, 100), 2)}%
          </div>
        </HFlex>
        <HFlex justifyContent="flex-end">
          <div>Low liquidation risk</div>
          <StatusDot mode="positive" />
        </HFlex>
        <HFlex gap={8} justifyContent="flex-start">
          <div
            className={css({
              color: "strongSurfaceContentAlt",
            })}
          >
            Interest rate
          </div>
          <div>
            {dn.format(dn.mul(position.interestRate, 100), 2)}%
          </div>
        </HFlex>
        <HFlex justifyContent="flex-end">
          <div>Low redemption risk</div>
          <StatusDot mode="positive" />
        </HFlex>
      </div>
    </section>
  );
}
