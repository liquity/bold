// All global CSS should be imported from here, for easier maintenance
import "@liquity2/uikit/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AboutModal } from "@/src/comps/AboutModal/AboutModal";
import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { Config } from "@/src/comps/Config/Config";
import { ConfigModal } from "@/src/comps/ConfigModal/ConfigModal";
import { Ethereum } from "@/src/comps/Ethereum/Ethereum";
import { UiKit } from "@liquity2/uikit";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bold",
  icons: "/favicon.svg",
};

export default function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UiKit>
          <Config>
            <Ethereum>
              <ConfigModal>
                <AboutModal>
                  <AppLayout>
                    {children}
                  </AppLayout>
                </AboutModal>
              </ConfigModal>
            </Ethereum>
          </Config>
        </UiKit>
      </body>
    </html>
  );
}
