import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Handslag Protokoll — Agentic Financial Handshake",
  description: "Agentic Financial Handshake: Autonomous policy-bounded B2B settlement where enterprise finances shake hands with verifiable claims and deterministic mandates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className={`${inter.className} bg-white text-zinc-950 antialiased min-h-screen selection:bg-zinc-950 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
