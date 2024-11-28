// All global styles should be imported here for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutModal } from "@/src/comps/AboutModal/AboutModal";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import content from "@/src/content";
import { DemoMode } from "@/src/demo-mode";
import { ArbitrumProvider } from "@/src/services/Arbitrum";
import { Prices } from "@/src/services/Prices";
import { StoredState } from "@/src/services/StoredState";
import { TransactionFlow } from "@/src/services/TransactionFlow";
import { UiKit } from "@liquity2/uikit";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: content.appName,
  icons: "/favicon.svg",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body className={GeistSans.className}>
        <UiKit>
          <StoredState>
            <DemoMode>
              <ArbitrumProvider>
                <Prices>
                  <TransactionFlow>
                    <AboutModal>
                      <AppLayout>{children}</AppLayout>
                    </AboutModal>
                  </TransactionFlow>
                </Prices>
              </ArbitrumProvider>
            </DemoMode>
          </StoredState>
        </UiKit>
      </body>
    </html>
  );
}
