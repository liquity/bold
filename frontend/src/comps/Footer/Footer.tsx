import { palette } from ":src/colors";
import * as stylex from "@stylexjs/stylex";
import logo from "./footer-logo.svg";

const links = [
  ["Liquity", "https://liquity.org"],
  ["Disclaimer", "https://example.org"],
  ["Privacy Policy", "https://example.org"],
];

const styles = stylex.create({
  main: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: 120,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    height: 64,
    paddingRight: 16,
    ":active": {
      translate: "0 1px",
    },
  },
  linksWrapper: {
    display: "flex",
    alignItems: "center",
  },
  links: {
    display: "flex",
    gap: 16,
  },
  link: {
    display: "flex",
    alignItems: "center",
    padding: 8,
    ":active": {
      translate: "0 1px",
    },
  },
  lastLink: {
    paddingRight: 0,
  },
});

export function Footer() {
  return (
    <footer {...stylex.props(styles.main)}>
      <div>
        <a
          href="/"
          {...stylex.props(styles.logo)}
        >
          <img
            alt="Bold"
            height={32}
            src={logo}
            width={82}
          />
        </a>
      </div>
      <div {...stylex.props(styles.linksWrapper)}>
        <ul {...stylex.props(styles.links)}>
          {links.map(([label, href], index) => (
            <li key={label + href}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: palette.rain }}
                {...stylex.props(
                  styles.link,
                  index === links.length - 1 && styles.lastLink,
                )}
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
