"use client";

import type { ReactNode } from "react";

import { useBreakpoint } from "@/src/breakpoints";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import { IconChevronSmallUp } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { useState } from "react";

export const LAYOUT_WIDTH = 1092;

type InfoBannerProps = {
  show: boolean;
  icon: ReactNode;
  messageDesktop: ReactNode;
  linkLabel: string;
  linkLabelMobile?: string;
  linkHref: string;
  linkExternal?: boolean;
  backgroundColor?: string;
};

export function InfoBanner({
  show,
  icon,
  messageDesktop,
  linkLabel,
  linkLabelMobile,
  linkHref,
  linkExternal = false,
  backgroundColor = token("colors.brandDarkBlue"),
}: InfoBannerProps) {
  const [compact, setCompact] = useState(false);
  useBreakpoint(({ medium }) => {
    setCompact(!medium);
  });

  const showTransition = useTransition(show, {
    from: { marginTop: -41 },
    enter: { marginTop: 0 },
    leave: { marginTop: -41 },
    config: {
      mass: 1,
      tension: 2000,
      friction: 160,
    },
  });

  return showTransition((style, shouldShow) => (
    shouldShow && (
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
            borderBottom: `1px solid #fff`,
          })}
          style={{ background: backgroundColor }}
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
            })}
          >
            {icon}
            <div>
              {!compact && messageDesktop}{" "}
              <LinkTextButton
                href={linkHref}
                external={linkExternal}
                label={
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <div>
                      {compact && linkLabelMobile ? linkLabelMobile : linkLabel}
                    </div>
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
                  color: "inherit!",
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
