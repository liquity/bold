import type { Dnum } from "@/src/types";

import { TokenAmount } from "@/src/comps/Amount/TokenAmount";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import { a, useInView, useTransition } from "@react-spring/web";

const infoItems = [{
  icon: "sbold",
  text: "sBOLD is an ERC-20 token",
}, {
  icon: "managed",
  text: "Managed by K3 Capital",
}, {
  icon: "compounding",
  text: "Auto-compounding",
}] as const;

const iconComponents = {
  sbold: () => <TokenIcon symbol="SBOLD" size={24} />,
  managed: ManagedIcon,
  compounding: CompoundingIcon,
} as const;

export function SboldInfo({
  conversion,
  loading,
}: {
  conversion: {
    mode: "deposit";
    boldAmount: Dnum;
    sboldAmount: Dnum | null;
  } | {
    mode: "redeem";
    boldAmount: Dnum | null;
    sboldAmount: Dnum;
  };
  loading: boolean;
}) {
  const [ref, inView] = useInView({ once: true });

  const iconsTrail = useTransition(
    infoItems.map((item) => ({ ...item, inView })),
    {
      keys: ({ text, inView }) => `${text}-${inView}`,
      from: {
        opacity: 0,
        transform: `
          scale3d(0.2, 0.2, 1)
          rotate3d(0, 0, 1, -180deg)
        `,
      },
      enter: {
        opacity: 1,
        transform: `
          scale3d(1, 1, 1)
          rotate3d(0, 0, 1, 0deg)
        `,
      },
      trail: 100,
      delay: 50,
      config: {
        mass: 1,
        tension: 800,
        friction: 60,
      },
    },
  );

  const bold = (
    <TokenAmount
      symbol="BOLD"
      animate={false}
      value={conversion.boldAmount}
      fallback={loading ? "… BOLD" : "− BOLD"}
      suffix=" BOLD"
    />
  );

  const sbold = (
    <TokenAmount
      symbol="SBOLD"
      animate={false}
      value={conversion.sboldAmount}
      fallback={loading ? "… sBOLD" : "− sBOLD"}
      suffix=" sBOLD"
    />
  );

  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        color: "content",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
        userSelect: "none",
        medium: {
          gap: 20,
        },
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          paddingBottom: 12,
          borderBottom: "1px solid token(colors.infoSurfaceBorder)",
          minWidth: 0,
        })}
      >
        <div>Conversion</div>
        <div
          className={css({
            flexShrink: 1,
            display: "grid",
            overflow: "hidden",
          })}
        >
          <ValueUpdate
            before={conversion.mode === "deposit" ? bold : sbold}
            after={conversion.mode === "deposit" ? sbold : bold}
          />
        </div>
      </div>
      <ul
        ref={ref}
        className={css({
          display: "grid",
          gridTemplateColumns: "none",
          gap: 16,
          fontSize: 15,
          medium: {
            gridTemplateColumns: "repeat(3, max-content)",
            gap: 16,
            fontSize: 14,
          },
        })}
      >
        {iconsTrail((props, item, _, index) => {
          const Icon = iconComponents[item.icon];
          return (
            <li
              key={index}
              className={css({
                display: "flex",
                gap: 12,
                flexDirection: "row",
                alignItems: "center",
                medium: {
                  gap: 16,
                  flexDirection: "column",
                  alignItems: "flex-start",
                },
              })}
            >
              <div
                className={css({
                  display: "flex",
                  paddingTop: {
                    base: 2,
                    medium: 0,
                  },
                })}
              >
                <a.div
                  className={css({
                    display: "grid",
                    placeItems: "center",
                    width: 28,
                    height: 28,
                    transformOrigin: "center",
                  })}
                  style={props}
                >
                  <Icon />
                </a.div>
              </div>
              <div>{item.text}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ManagedIcon() {
  return (
    <svg width="20" height="24" fill="none">
      <path
        fill="#63D77D"
        d="M10 0 0 4.364v6.545C0 16.964 4.267 22.625 10 24c5.733-1.375 10-7.036 10-13.09V4.363L10 0Z"
      />
      <circle cx="6" cy="9" r="2" fill="#1C1D4F" />
      <circle cx="14" cy="15" r="2" fill="#1C1D4F" />
      <path fill="#1C1D4F" d="M14.445 6.037 15.86 7.45 5.45 17.861l-1.414-1.414z" />
    </svg>
  );
}

function CompoundingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="24" fill="none">
      <circle cx="16" cy="12.001" r="10" fill="#fff" />
      <path
        fill="#63D77D"
        d="M16 0A12 12 0 0 0 4 12H0l5.334 5.333L10.667 12h-4a9.327 9.327 0 0 1 9.334-9.333A9.327 9.327 0 0 1 25.334 12a9.326 9.326 0 0 1-14.747 7.6l-1.893 1.92A12.002 12.002 0 0 0 27.87 10.24 12 12 0 0 0 16 0Z"
      />
      <circle cx="16" cy="12" r="3" fill="#1C1D4F" />
    </svg>
  );
}
