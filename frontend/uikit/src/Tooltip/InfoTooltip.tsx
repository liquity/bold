"use client";

import type { ReactNode } from "react";

import { css } from "../../styled-system/css";
import { AnchorButton } from "../Button/AnchorButton";
import { IconExternal, IconInfo } from "../icons";
import { TextButton } from "../TextButton/TextButton";
import { Tooltip } from "./Tooltip";

type ContentObject = {
  heading: ReactNode;
  body: ReactNode;
  footerLink?: { href: string; label: ReactNode };
};

export function InfoTooltip(
  props:
    & {
      level?: "info" | "warning";
    }
    & (
      | {
        children?: ReactNode;
        heading?: ReactNode;
      }
      | {
        content:
          // one item = body only
          | [ReactNode]
          // two items = heading + body
          | [ReactNode, ReactNode]
          // object format
          | ContentObject;
      }
    ),
) {
  const heading = "content" in props
    ? Array.isArray(props.content) ? props.content.length === 2 && props.content[0] : props.content.heading
    : props.heading;

  const children = "content" in props
    ? (
      Array.isArray(props.content)
        ? props.content.length === 2 ? props.content[1] : props.content[0]
        : props.content.footerLink
        ? (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            })}
          >
            <Body>{props.content.body}</Body>
            {props.content.footerLink && (
              <AnchorButton
                external
                href={props.content.footerLink.href}
                label={
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      width: "100%",
                    })}
                  >
                    <div
                      className={css({
                        fontSize: 14,
                      })}
                    >
                      {props.content.footerLink.label}
                    </div>
                    <IconExternal size={16} />
                  </div>
                }
                mode="primary"
                shape="rectangular"
                size="medium"
                wide
              />
            )}
          </div>
        )
        : <Body>{props.content.body}</Body>
    )
    : <Body>{props.children}</Body>;

  const level = props.level ?? "info";

  return (
    <Tooltip
      opener={({ buttonProps, setReference }) => (
        <TextButton
          ref={setReference}
          label={
            <div
              className={css({
                display: "flex",
                width: 16,
                height: 16,
                "--color-warning": "token(colors.warning)",
              })}
              style={{
                color: level === "warning" ? "var(--color-warning)" : "inherit",
              }}
            >
              <IconInfo size={16} />
            </div>
          }
          className={css({
            color: "contentAlt2!",
          })}
          {...buttonProps}
        />
      )}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
        })}
      >
        {heading && (
          <h1
            className={css({
              textWrap: "wrap",
            })}
          >
            {heading}
          </h1>
        )}
        {children}
      </div>
    </Tooltip>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        fontSize: 14,
        color: "#878AA4",
        "& a": {
          color: "token(colors.accent)",
          textDecoration: "underline",
        },
      })}
    >
      {children}
    </div>
  );
}
