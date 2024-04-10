"use client";

import { palette } from "@/src/colors";
import { TextButton } from "@/src/comps/Button/TextButton";
import { useConfigModal } from "@/src/comps/ConfigModal/ConfigModal";
import { APP_VERSION, COMMIT_HASH } from "@/src/env";
import { css } from "@/styled-system/css";
import Image from "next/image";
import Link from "next/link";

import logo from "./footer-logo.svg";

export function Footer() {
  const { open: openConfigModal } = useConfigModal();

  const links: Array<[
    string | [string, string],
    string | (() => void),
  ]> = [
    // ["Liquity", "https://liquity.org"],
    // ["Disclaimer", "https://example.org"],
    // ["Privacy Policy", "https://example.org"],
    ["Settings", openConfigModal],
    [
      [
        `${APP_VERSION}-${COMMIT_HASH}`,
        `Version ${APP_VERSION} (${COMMIT_HASH})`,
      ],
      "https://github.com/liquity/bold/tree/" + COMMIT_HASH,
    ],
  ];

  return (
    <footer
      className={css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: 120,
      })}
    >
      <div>
        <Link
          href="/"
          className={css({
            display: "flex",
            alignItems: "center",
            height: 64,
            paddingRight: 16,
            _active: {
              translate: "0 1px",
            },
          })}
        >
          <Image
            alt="Bold"
            height={32}
            src={logo}
            width={82}
          />
        </Link>
      </div>
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
                      rel="noopener noreferrer"
                      target="_blank"
                      title={title}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        padding: 8,
                        paddingRight: index === links.length - 1 ? 0 : 8,
                        _active: {
                          translate: "0 1px",
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
