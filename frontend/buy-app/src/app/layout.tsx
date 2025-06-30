import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nerite - Buy USND",
  description: "Buy USND",
  icons: "/nerite.svg",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
