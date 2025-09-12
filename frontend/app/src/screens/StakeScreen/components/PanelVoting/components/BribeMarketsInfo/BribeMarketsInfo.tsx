import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { IconExternal } from "@liquity2/uikit";
import { css } from "@/styled-system/css";

import type { FC } from "react";

const url =
  "https://www.liquity.org/blog/bribe-markets-in-liquity-v2-strategic-value-for-lqty-stakers";

export const BribeMarketsInfo: FC = () => (
  <div
    className={css({
      display: "flex",
      flexDirection: "column",
      padding: 16,
      color: "content",
      background: "fieldSurface",
      border: "1px solid token(colors.border)",
      borderRadius: 8,
      marginBottom: 16,
      marginTop: -16,
      gap: {
        base: 16,
        medium: 16,
      },
    })}
  >
    <header
      className={css({
        display: "flex",
        flexDirection: "column",
        fontSize: 16,
        gap: {
          base: 16,
          medium: 0,
        },
      })}
    >
      <h1
        className={css({
          fontWeight: 600,
        })}
      >
        Bribe Markets in Liquity V2
      </h1>
      <p
        className={css({
          fontSize: 15,
          color: "contentAlt",
        })}
      >
        Initiatives may offer bribes to incentivize votes, which are displayed
        in the table above and can be claimed afterwards on this page.
      </p>
    </header>
    <LinkTextButton
      external
      href={url}
      label={
        <span
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "accent",
          })}
        >
          <span>Learn more about bribes</span>
          <IconExternal size={16} />
        </span>
      }
    />
  </div>
);
