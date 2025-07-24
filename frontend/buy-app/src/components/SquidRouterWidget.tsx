"use client";

import dynamic from "next/dynamic";

// Dynamically import SquidWidget with SSR disabled
const SquidWidget = dynamic(
  () => import("@0xsquid/widget").then((mod) => ({ default: mod.SquidWidget })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col justify-center items-center w-full gap-3 mt-1">
        <div className="w-[480px] h-[660px] bg-gray-100 rounded-[2rem] animate-pulse" style={{ boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.20), 0px 5px 50px -1px rgba(0, 0, 0, 0.33)" }}>
          <div className="flex justify-center items-center h-full w-full">
            <div className="relative h-8 w-8 flex items-center justify-center mt-8">
              <div className="absolute inset-0 rounded-full border-3 border-gray-300 border-t-transparent animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    ),
  }
);

export function SquidRouterWidget() {
  return (
    <SquidWidget config={{
      integratorId: process.env.NEXT_PUBLIC_SQUID_INTEGRATOR_ID ?? "",
      theme: {
        borderRadius: {
          "button-lg-primary": "3.75rem",
          "button-lg-secondary": "3.75rem",
          "button-lg-tertiary": "3.75rem",
          "button-md-primary": "1.25rem",
          "button-md-secondary": "1.25rem",
          "button-md-tertiary": "1.25rem",
          "button-sm-primary": "1.25rem",
          "button-sm-secondary": "1.25rem",
          "button-sm-tertiary": "1.25rem",
          "container": "1.875rem",
          "input": "9999px",
          "menu-sm": "0.9375rem",
          "menu-lg": "1.25rem",
          "modal": "1.875rem"
        },
        fontSize: {
          "caption": "0.875rem",
          "body-small": "1.14375rem",
          "body-medium": "1.40625rem",
          "body-large": "1.75625rem",
          "heading-small": "2.1875rem",
          "heading-medium": "3.08125rem",
          "heading-large": "4.40625rem"
        },
        fontWeight: {
          "caption": "400",
          "body-small": "400",
          "body-medium": "400",
          "body-large": "400",
          "heading-small": "400",
          "heading-medium": "400",
          "heading-large": "400"
        },
        boxShadow: {
          "container": "0px 2px 4px 0px rgba(0, 0, 0, 0.20), 0px 5px 50px -1px rgba(0, 0, 0, 0.33)"
        },
        color: {
          "grey-100": "#FBFBFD",
          "grey-200": "#EDEFF3",
          "grey-300": "#2f4225",
          "grey-400": "#A7ABBE",
          "grey-500": "#2f4225",
          "grey-600": "#676B7E",
          "grey-700": "#4C515D",
          "grey-800": "#f3eee2",
          "grey-900": "#f6f6f6",
          "royal-300": "#D9BEF4",
          "royal-400": "#B893EC",
          "royal-500": "#2f4225",
          "royal-600": "#8353C5",
          "royal-700": "#6B45A1",
          "status-positive": "#8bb2b7",
          "status-negative": "#f3c2a5",
          "status-partial": "#676B7E",
          "highlight-700": "#E4FE53",
          "animation-bg": "#2f4225",
          "animation-text": "#f3eee2",
          "button-lg-primary-bg": "#2f4225",
          "button-lg-primary-text": "#f3eee2",
          "button-lg-secondary-bg": "#FBFBFD",
          "button-lg-secondary-text": "#292C32",
          "button-lg-tertiary-bg": "#292C32",
          "button-lg-tertiary-text": "#D1D6E0",
          "button-md-primary-bg": "#2f4225",
          "button-md-primary-text": "#f3eee2",
          "button-md-secondary-bg": "#FBFBFD",
          "button-md-secondary-text": "#292C32",
          "button-md-tertiary-bg": "#292C32",
          "button-md-tertiary-text": "#D1D6E0",
          "button-sm-primary-bg": "#9E79D2",
          "button-sm-primary-text": "#FBFBFD",
          "button-sm-secondary-bg": "#FBFBFD",
          "button-sm-secondary-text": "#292C32",
          "button-sm-tertiary-bg": "#292C32",
          "button-sm-tertiary-text": "#D1D6E0",
          "input-bg": "#f3eee2",
          "input-placeholder": "#2f4225",
          "input-text": "#2f4225",
          "input-selection": "#2f4225",
          "menu-bg": "#2f4225",
          "menu-text": "#f3eee2",
          "menu-backdrop": "#FBFBFD1A",
          "modal-backdrop": "#17191C54"
        }
      },
      apiUrl: "https://v2.api.squidrouter.com",
      priceImpactWarnings: {
        "warning": 3,
        "critical": 5
      },
      initialAssets: {
        from: {
          address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH on Arbitrum
          chainId: "42161",
        },
        to: {
          address: "0x4ecf61a6c2fab8a047ceb3b3b263b401763e9d49", // USND
          chainId: "42161",
        }
      },
      loadPreviousStateFromLocalStorage: true,
      hideAnimations: false
    }} />
  )
}