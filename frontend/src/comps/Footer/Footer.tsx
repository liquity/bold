import { palette } from "@/src/colors";
import { css } from "@/styled-system/css";
import Image from "next/image";
import Link from "next/link";
import logo from "./footer-logo.svg";

const links = [
  ["Liquity", "https://liquity.org"],
  ["Disclaimer", "https://example.org"],
  ["Privacy Policy", "https://example.org"],
];

export function Footer() {
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
          {links.map(([label, href]) => (
            <li key={label + href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: palette.rain }}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  padding: 8,
                  _lastOfType: {
                    paddingRight: 0,
                  },
                  _active: {
                    translate: "0 1px",
                  },
                })}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
