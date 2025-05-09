"use client";

import { useBreakpoint } from "@/src/breakpoints";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { useLegacyPositions } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { IconChevronSmallUp, IconWarning } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { useState } from "react";

export const LAYOUT_WIDTH = 1092;

export function LegacyPositionsBanner() {
  const account = useAccount();
  const legacyPositions = useLegacyPositions(account.address ?? null);

  const [compact, setCompact] = useState(false);
  useBreakpoint(({ medium }) => {
    setCompact(!medium);
  });

  const showTransition = useTransition(
    Boolean(account.address && legacyPositions.data?.hasAnyPosition),
    {
      from: { marginTop: -41 },
      enter: { marginTop: 0 },
      leave: { marginTop: -41 },
      config: {
        mass: 1,
        tension: 2000,
        friction: 160,
      },
    },
  );

  return showTransition((style, show) => (
    show && (
      <a.div style={style}>
        <div
          className={css({
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            maxWidth: "100%",
            width: "100%",
            height: 41,
            padding: "0 16px",
            textAlign: "center",
            color: "#fff",
            background: "strongSurface",
            borderBottom: "1px solid #fff",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              maxWidth: LAYOUT_WIDTH,
              whiteSpace: "nowrap",
              color: "yellow:400",
            })}
          >
            <IconWarning size={16} />
            <div>
              {!compact && <>{"You still have open positions on Liquity V2-Legacy. "}</>}
              <LinkTextButton
                href="/legacy"
                label={
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    {compact
                      ? (
                        <div>
                          Your Liquity V2-Legacy positions
                        </div>
                      )
                      : (
                        <div>
                          Check legacy positions
                        </div>
                      )}
                    <div
                      className={css({
                        transformOrigin: "50% 50%",
                        transform: "translateY(1px) rotate(90deg)",
                      })}
                    >
                      <IconChevronSmallUp size={12} />
                    </div>
                  </div>
                }
                className={css({
                  color: "yellow:400!",
                  textDecoration: "underline",
                })}
              />
            </div>
          </div>
        </div>
      </a.div>
    )
  ));
}
