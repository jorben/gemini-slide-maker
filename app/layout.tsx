import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "PPTMaker - AI-powered presentation generator",
  description:
    "An AI-powered presentation generator that transforms text and documents into professional slides",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <Script
          src="https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
