// All global styles should be imported here for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutModal } from "@/src/comps/AboutModal/AboutModal";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { Config } from "@/src/comps/Config/Config";
import { ConfigModal } from "@/src/comps/ConfigModal/ConfigModal";
import { Ethereum } from "@/src/comps/Ethereum/Ethereum";
import { Prices } from "@/src/prices";
import { UiKit } from "@liquity2/uikit";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: "Liquity v2",
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
          <Config>
            <Ethereum>
              <Prices>
                <ConfigModal>
                  <AboutModal>
                    <AppLayout>
                      {children}
                    </AppLayout>
                  </AboutModal>
                </ConfigModal>
              </Prices>
            </Ethereum>
          </Config>
        </UiKit>
      </body>
    </html>
  );
}
