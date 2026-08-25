import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Settlement Network — Autonomous B2B Settlement Protocol",
  description: "Autonomous policy-bounded settlement between finance agents using verifiable claims and deterministic mandates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
