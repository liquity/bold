import { a, useSpring } from "@react-spring/web";
import { css } from "@/styled-system/css";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview.tsx";
import { match, P } from "ts-pattern";
import { Spinner } from "@/src/comps/Spinner/Spinner.tsx";
import { token } from "@/styled-system/tokens";
import { IconBorrow, IconLeverage, Button } from "@liquity2/uikit";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";

import type { FC, PropsWithChildren } from "react";
import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen.tsx";

interface LoadingCardProps extends PropsWithChildren {
  height: number;
  leverage: boolean;
  loadingState: LoadingState;
  onRetry: () => void;
  txPreviewMode?: boolean;
}

export const LoadingCard: FC<LoadingCardProps> = ({
  height,
  loadingState,
  txPreviewMode,
  leverage,
  onRetry,
  children,
}) => {
  const title = leverage ? "Multiply" : `${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} loan`;

  const spring = useSpring({
    to: match(loadingState)
      .with(P.union("loading", "error", "not-found"), (s) => ({
        cardtransform: "scale3d(0.95, 0.95, 1)",
        // bottom bar 2
        containerHeight:
          window.innerHeight -
          120 - // top bar
          24 * 2 - // padding
          48 - // bottom bar 1
          40,
        cardHeight: s === "error" || s === "not-found" ? 180 : 120,
        cardBackground: token("colors.blue:50"),
        cardColor: token("colors.blue:950"),
      }))
      .otherwise(() => ({
        cardtransform: "scale3d(1, 1, 1)",
        containerHeight: height,
        cardHeight: height,
        cardBackground: token("colors.position"),
        cardColor: token("colors.white"),
      })),
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  return (
    <a.div
      className={css({
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        width: "100%",
      })}
      style={{
        height: spring.containerHeight,
      }}
    >
      <a.section
        className={css({
          overflow: "hidden",
          width: "100%",
          padding: "16px 16px 0",
          borderRadius: 8,
          userSelect: "none",
        })}
        style={{
          height: loadingState === "success" ? height : spring.cardHeight,
          color: spring.cardColor,
          background: spring.cardBackground,
          transform: spring.cardtransform,
          willChange: "transform",
        }}
      >
        {txPreviewMode && loadingState === "success" && <TagPreview />}
        <h1
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingBottom: 12,
          })}
          style={{
            opacity: Number(loadingState === "success"),
            pointerEvents: loadingState === "success" ? "auto" : "none",
          }}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
              fontSize: 12,
              textTransform: "uppercase",
              userSelect: "none",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt2",
              })}
            >
              {leverage ? <IconLeverage size={16} /> : <IconBorrow size={16} />}
            </div>
            {title}
          </div>
        </h1>
        {match(loadingState)
          .with("loading", () => (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                fontSize: 18,
              })}
            >
              Fetching
              <Spinner size={18} />
            </div>
          ))
          .with("error", () => (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                gap: 16,
                fontSize: 18,
                padding: 16,
              })}
            >
              <div>Error fetching data</div>
              <Button
                mode="primary"
                label="Try again"
                size="small"
                onClick={onRetry}
              />
            </div>
          ))
          .otherwise(() => (
            <div>{children}</div>
          ))}
      </a.section>
    </a.div>
  );
};
