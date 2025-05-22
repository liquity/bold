import type { FmtnumOptions, FmtnumPresetName } from "@/src/formatting";

import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { a, useTransition } from "@react-spring/web";

export function Amount({
  fallback = "",
  fixed = false, // fixed numbers width
  format,
  percentage = false,
  prefix = "",
  suffix = "",
  title: titleParam,
  value,
}: {
  fallback?: string;
  fixed?: boolean;
  format?: FmtnumPresetName | number;
  percentage?: boolean;
  prefix?: string;
  suffix?: string;
  title?: string | null | {
    prefix?: string;
    suffix?: string;
  };
  value: Parameters<typeof fmtnum>[0];
}) {
  const scale = percentage ? 100 : 1;

  if (percentage && !suffix) {
    suffix = "%";
  }
  if (format === undefined) {
    if (percentage) {
      format = "pct2z";
    } else {
      format = "2z";
    }
  }

  const showFallback = value === null || value === undefined;

  const fmtOptions: FmtnumOptions = { prefix, scale, suffix };
  if (typeof format === "number") {
    fmtOptions.digits = format;
  } else if (typeof format === "string") {
    fmtOptions.preset = format;
  }

  const content = showFallback ? fallback : fmtnum(value, fmtOptions);

  const title = showFallback ? undefined : (
    titleParam === undefined
      ? fmtnum(value, { prefix, preset: "full", scale }) + suffix
      : typeof titleParam === "string"
      ? titleParam
      : titleParam === null
      ? undefined
      : fmtnum(value, {
        prefix: titleParam.prefix,
        preset: "full",
        scale,
        suffix: titleParam.suffix,
      })
  );

  const fallbackTransition = useTransition([{ content, title, showFallback }], {
    keys: (item) => String(item.showFallback),
    initial: {
      transform: "scale(1)",
    },
    from: {
      transform: "scale(0.9)",
    },
    enter: {
      transform: "scale(1)",
    },
    leave: {
      display: "none",
      immediate: true,
    },
    config: {
      mass: 1,
      tension: 2000,
      friction: 80,
    },
  });

  return fallbackTransition((style, { content, title }) => (
    <a.div
      title={title ?? undefined}
      className={css({
        display: "inline-flex",
        width: "fit-content",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        transformOrigin: "50% 50%",
        textDecoration: "inherit",
      })}
      style={{
        transform: style.transform,
        fontVariantNumeric: fixed ? "tabular-nums" : undefined,
      }}
    >
      {content}
    </a.div>
  ));
}
