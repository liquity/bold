// All global styles should be imported here for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BreakpointName } from "@/src/breakpoints";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { Blocking } from "@/src/comps/Blocking/Blocking";
import content from "@/src/content";
import { DemoMode } from "@/src/demo-mode";
import { VERCEL_ANALYTICS } from "@/src/env";
import { Arbitrum } from "@/src/services/Arbitrum";
import { ReactQuery } from "@/src/services/ReactQuery";
import { StoredState } from "@/src/services/StoredState";
import { TransactionFlow } from "@/src/services/TransactionFlow";
import { UiKit } from "@liquity2/uikit";
import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";
import { SubgraphStatus } from "../services/SubgraphStatus";

export const metadata: Metadata = {
  title: content.appName,
  icons: "/nerite.svg",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body className={GeistSans.className}>
        <UiKit>
          <ReactQuery>
            <StoredState>
              <BreakpointName>
                <DemoMode>
                  <Arbitrum>
                    <SubgraphStatus>
                      <Blocking>
                        <TransactionFlow>
                          <AppLayout>{children}</AppLayout>
                        </TransactionFlow>
                      </Blocking>
                    </SubgraphStatus>
                  </Arbitrum>
                </DemoMode>
              </BreakpointName>
            </StoredState>
          </ReactQuery>
        </UiKit>
        {VERCEL_ANALYTICS && <Analytics />}
      </body>
    </html>
  );
}
