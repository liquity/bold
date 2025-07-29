import type { FmtnumOptions, FmtnumPresetName } from "@/src/formatting";

import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { a, useTransition } from "@react-spring/web";

export function Amount({
  animate = true,
  dust = true,
  fallback = "",
  fixed = false, // fixed numbers width
  format,
  percentage = false,
  prefix = "",
  suffix = "",
  title: titleParam,
  value,
}: {
  animate?: boolean;
  dust?: boolean;
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

  const fmtOptions: FmtnumOptions = { dust, prefix, scale, suffix };
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

  const appear = useTransition({
    showFallback,
    content,
  }, {
    keys: (val) => String(val.showFallback),
    from: { opacity: 0, transform: "scale(0.9)" },
    enter: { opacity: 1, transform: "scale(1)" },
    config: { mass: 1, tension: 2000, friction: 80 },
    immediate: !animate,
  });

  return (
    <span
      title={title ?? undefined}
      className={css({
        display: "inline",
        textDecoration: "inherit",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        transformOrigin: "50% 50%",
      })}
      style={{
        fontVariantNumeric: fixed ? "tabular-nums" : undefined,
      }}
    >
      {appear((style, { showFallback, content }) => (
        showFallback ? content : (
          <a.span
            style={{
              display: "inline",
              transform: style.transform,
            }}
          >
            {content}
          </a.span>
        )
      ))}
    </span>
  );
}
