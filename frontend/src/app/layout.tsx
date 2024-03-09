// All global CSS should be imported from here for easier maintenance
import "@/src/index.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppLayout } from "@/src/comps/AppLayout/AppLayout";
import { Ethereum } from "@/src/comps/Ethereum/Ethereum";
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
        <Ethereum>
          <AppLayout>
            {children}
          </AppLayout>
        </Ethereum>
      </body>
    </html>
  );
}
