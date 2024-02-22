import { css } from ":panda/css";
import { palette } from ":src/colors";
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
        <a
          href="/"
          className={css({
            display: "flex",
            alignItems: "center",
            height: 64,
            paddingRight: 16,
            "&:active": {
              translate: "0 1px",
            },
          })}
        >
          <img
            src={logo}
            alt="Bold"
            width={82}
            height={32}
          />
        </a>
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
            "& li:last-child a": {
              paddingRight: 0,
            },
          })}
        >
          {links.map(([label, href]) => (
            <li key={label + href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  padding: 8,
                  "&:active": {
                    translate: "0 1px",
                  },
                })}
                style={{ color: palette.rain }}
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
