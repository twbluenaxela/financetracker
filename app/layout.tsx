import "./globals.css";
import type { ReactNode } from "react";
import localFont from "next/font/local";

const manrope = localFont({
  src: "../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-sans",
  display: "swap",
});

const notoSansTc = localFont({
  src: [
    { path: "../node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-cjk",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "家庭理財",
  description: "Shared Family Wealth Dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className={`${manrope.variable} ${notoSansTc.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
