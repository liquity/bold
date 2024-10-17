import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { AnchorTextButton, IconExternal, TokenIcon } from "@liquity2/uikit";

export function GasCompensationInfo() {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        color: "content",
        background: "fieldSurface",
        border: "1px solid token(colors.border)",
        borderRadius: 8,
      })}
    >
      <h1
        className={css({
          display: "flex",
          flexDirection: "column",
          fontSize: 16,
          fontWeight: 600,
        })}
      >
        Gas compensation deposit
      </h1>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 16,
          fontSize: 15,
          color: "contentAlt",
        })}
      >
        <p>
          When opening a loan, an additional deposit of{" "}
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            })}
          >
            {fmtnum(ETH_GAS_COMPENSATION, 4)}
            <span>
              ETH
            </span>
            <TokenIcon symbol="ETH" size="mini" />
          </span>{" "}
          is set aside. It is not part of the loan collateral and does not back any debt in the system. Its purpose is
          to cover the gas fees for liquidating the loan, should it become undercollateralized.
        </p>
        <p>
          This deposit gets entirely refunded when the loan gets closed.
        </p>
      </div>

      <div>
        <AnchorTextButton
          href="https://github.com/liquity/bold#liquidation-gas-compensation"
          rel="noopener noreferrer"
          target="_blank"
          label={
            <span
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "accent",
              })}
            >
              <span>
                Learn more about the liquidation gas compensation
              </span>
              <IconExternal size={16} />
            </span>
          }
        >
        </AnchorTextButton>
      </div>
    </section>
  );
}
