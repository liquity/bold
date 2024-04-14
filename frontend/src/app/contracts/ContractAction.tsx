import type { ReactNode } from "react";

import { Button } from "@/src/comps/Button/Button";
import { TextButton } from "@/src/comps/Button/TextButton";
import { css } from "@/styled-system/css";

export function ContractAction({
  buttonLabel,
  children,
  error,
  onFillExample,
  onSubmit,
  title,
}: {
  buttonLabel?: string;
  children?: ReactNode;
  error: {
    name: string;
    message: string;
  } | null;
  onFillExample?: () => void;
  onSubmit?: () => void;
  title: string;
}) {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 40,
        width: "100%",
        padding: 40,
        background: "#F7F7FF",
        borderRadius: 8,
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        })}
      >
        <h1
          className={css({
            fontSize: 24,
          })}
        >
          {title}
        </h1>
        {onFillExample && (
          <TextButton
            label="Example"
            onClick={onFillExample}
          />
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 16,
        })}
      >
        {children}
        <div
          className={css({
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: 16,
          })}
        >
          <Button label={buttonLabel ?? title} />
        </div>
        {error && (
          <div
            className={css({
              paddingTop: 32,
            })}
          >
            <div
              className={css({
                position: "relative",
              })}
            >
              <div
                className={css({
                  position: "absolute",
                  zIndex: 1,
                  inset: 0,
                  background: "negative",
                  opacity: 0.8,
                })}
              />
              <div
                className={css({
                  position: "relative",
                  zIndex: 2,
                  overflow: "auto",
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  color: "white",
                  fontSize: 14,
                })}
              >
                <p
                  className={css({
                    fontSize: 16,
                    whiteSpace: "nowrap",
                  })}
                >
                  Error: {error.name}
                </p>
                <div
                  className={css({
                    whiteSpace: "pre-wrap",
                  })}
                >
                  {error.message}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
