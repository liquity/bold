// All global styles should be imported here for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { BreakpointName } from "@/src/breakpoints";
import { About } from "@/src/comps/About/About";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { Blocking } from "@/src/comps/Blocking/Blocking";
import content from "@/src/content";
import { VERCEL_ANALYTICS } from "@/src/env";
import { Ethereum } from "@/src/services/Ethereum";
import { IndicatorManager } from "@/src/services/IndicatorManager";
import { ReactQuery } from "@/src/services/ReactQuery";
import { StoredState } from "@/src/services/StoredState";
import { TransactionFlow } from "@/src/services/TransactionFlow";
import { UiKit } from "@liquity2/uikit";
import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: content.appName,
  icons: "/favicon.svg",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <ReactQuery>
          <UiKit>
            <StoredState>
              <BreakpointName>
                <Ethereum>
                  <IndicatorManager>
                    <Blocking>
                      <TransactionFlow>
                        <About>
                          <AppLayout>
                            {children}
                          </AppLayout>
                        </About>
                      </TransactionFlow>
                    </Blocking>
                  </IndicatorManager>
                </Ethereum>
              </BreakpointName>
            </StoredState>
          </UiKit>
        </ReactQuery>
        {VERCEL_ANALYTICS && <Analytics />}
      </body>
    </html>
  );
}
