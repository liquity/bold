"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { AnchorTextButton, HFlex } from "@liquity2/uikit";

export function BuyScreen() {
  return (
    <Screen
      heading={{
        title: <HFlex>{content.buyScreen.headline()}</HFlex>,
        subtitle: (
          <>
            {content.buyScreen.subheading}{" "}
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
      BUY USDN
    </Screen>
  );
}
