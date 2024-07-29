// All global styles should be imported here for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutModal } from "@/src/comps/AboutModal/AboutModal";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { APP_TITLE } from "@/src/constants";
import { DemoMode } from "@/src/demo-mode";
import { Ethereum } from "@/src/services/Ethereum";
import { Prices } from "@/src/services/Prices";
import { TransactionFlow } from "@/src/services/TransactionFlow";
import { UiKit } from "@liquity2/uikit";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: APP_TITLE,
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
        </UiKit>
      </body>
    </html>
  );
}
