"use client";

import { palette } from "@/src/colors";
// import { useAboutModal } from "@/src/comps/AboutModal/AboutModal";
import { css } from "@/styled-system/css";
import { TextButton } from "@liquity2/uikit";
import Link from "next/link";

export function Footer() {
  // const aboutModal = useAboutModal();

  const links: Array<[
    string | [string, string],
    string | (() => void),
  ]> = [
    // ["Liquity", "https://liquity.org"],
    // ["Disclaimer", "https://example.org"],
    // ["Privacy Policy", "https://example.org"],
    // ["Contracts", "/contracts"],
    // ["About", aboutModal.open],
  ];

  return (
    <footer
      className={css({
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        // height: 120,
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
        })}
      >
        <ul
          className={css({
            display: "flex",
            gap: 16,
          })}
        >
          {links.map(([labelTitle, href], index) => {
            const [label, title] = Array.isArray(labelTitle) ? labelTitle : [labelTitle, undefined];
            return (
              <li key={label + href}>
                {typeof href === "string"
                  ? (
                    <Link
                      href={href}
                      {...href.startsWith("http") && {
                        rel: "noopener noreferrer",
                        target: "_blank",
                      }}
                      title={title}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        padding: 8,
                        paddingRight: index === links.length - 1 ? 0 : 8,
                        _active: {
                          translate: "0 1px",
                        },
                        _focusVisible: {
                          outline: "2px solid token(colors.focused)",
                          borderRadius: 4,
                        },
                      })}
                      style={{ color: palette.rain }}
                    >
                      {label}
                    </Link>
                  )
                  : (
                    <TextButton
                      label={label}
                      onClick={href}
                      title={title}
                      style={{
                        padding: 8,
                        color: palette.rain,
                      }}
                    />
                  )}
              </li>
            );
          })}
        </ul>
      </div>
    </footer>
  );
}
