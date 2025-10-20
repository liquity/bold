
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { css } from "@/styled-system/css";

export function BottomBar() {
  return (
    <div
      className={css({
        overflow: "hidden",
        width: "100%",
        padding: {
          base: 0,
          medium: "0 24px",
        },
      })}
    >
      <div
        className={css({
          display: "flex",
          width: "100%",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            height: 48,
            paddingLeft: {
              base: 12,
              medium: 0,
            },
            paddingRight: {
              base: 12,
              medium: 0,
            },
            fontSize: 12,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            userSelect: "none",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
            })}
          >
            <LinkTextButton
              external
              href="https://x.com/mustangfinance"
              label={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  })}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span style={{ color: "white", fontSize: 14 }}>Twitter (X)</span>
                </div>
              }
              className={css({
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "12px",
                _hover: {
                  color: "white",
                  textDecoration: "underline",
                },
              })}
            />
          </div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "12px",
            })}
          >
            <span>© Saga Stablecoin 2025 All rights reserved</span>
            <LinkTextButton
              external
              href="#"
              label="Privacy Policy"
              className={css({
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "12px",
                _hover: {
                  color: "white",
                  textDecoration: "underline",
                },
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}