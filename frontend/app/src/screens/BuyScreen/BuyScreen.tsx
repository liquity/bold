"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { AnchorTextButton, HFlex } from "@liquity2/uikit";
// import { SquidWidget } from "@0xsquid/widget";
// import { SquidRouterWidget } from "@/src/comps/Widget/SquidRouterWidget";
import { css } from "@/styled-system/css";

export function BuyScreen() {
  return (
    <Screen
      heading={{
        title: <HFlex>{content.buyScreen.headline()}</HFlex>,
        subtitle: (
          <>
            {/* {content.buyScreen.subheading}{" "} */}
            <AnchorTextButton
              label={content.buyScreen.learnMore[1]}
              href={content.buyScreen.learnMore[0]}
              external
            />
          </>
        ),
      }}
      gap={48}
    >
      <div className={css({
        display: "flex",
        flexDirection: "column",
        gap: 48,
        width: 534,
        justifyContent: "center",
        alignItems: "center",
      })}>
        {/* <SquidRouterWidget /> */}
      </div>
    </Screen>
  );
}
