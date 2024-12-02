// All global styles should be imported here for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutModal } from "@/src/comps/AboutModal/AboutModal";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import content from "@/src/content";
import { DemoMode } from "@/src/demo-mode";
import { VERCEL_ANALYTICS } from "@/src/env";
import { Ethereum } from "@/src/services/Ethereum";
import { Prices } from "@/src/services/Prices";
import { StoredState } from "@/src/services/StoredState";
import { TransactionFlow } from "@/src/services/TransactionFlow";
import { UiKit } from "@liquity2/uikit";
import { Analytics } from "@vercel/analytics/react";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: content.appName,
  icons: "/favicon.svg",
};

export default function Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.className}>
        <UiKit>
          <StoredState>
            <DemoMode>
              <Ethereum>
                <Prices>
                  <TransactionFlow>
                    <AboutModal>
                      <AppLayout>
                        {children}
                      </AppLayout>
                    </AboutModal>
                  </TransactionFlow>
                </Prices>
              </Ethereum>
            </DemoMode>
          </StoredState>
        </UiKit>
        {VERCEL_ANALYTICS && <Analytics />}
      </body>
    </html>
  );
}
