// All global CSS should be imported from here for easier maintenance
import "@/src/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { Config } from "@/src/comps/Config/Config";
import { ConfigModal } from "@/src/comps/ConfigModal/ConfigModal";
import { Ethereum } from "@/src/comps/Ethereum/Ethereum";
import { RootEntryPoint } from "@/src/comps/Root/Root";
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
        <RootEntryPoint>
          <Config>
            <Ethereum>
              <ConfigModal>
                <AppLayout>
                  {children}
                </AppLayout>
              </ConfigModal>
            </Ethereum>
          </Config>
        </RootEntryPoint>
      </body>
    </html>
  );
}
