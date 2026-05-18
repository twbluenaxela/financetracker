import "./globals.css";
import type { ReactNode } from "react";
import { JetBrains_Mono, Manrope, Noto_Sans_TC } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cjk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
