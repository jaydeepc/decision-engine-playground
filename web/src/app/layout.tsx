import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Decision Engine Playground · Laya",
  description:
    "Try Laya, an open-source 33 ms System 1 decision engine, in a chat-style playground. Learn how decision engines work, call the hosted API, design your own model and fine-tune it.",
  icons: { icon: "/brand/laya-mark.svg" },
  openGraph: {
    title: "Decision Engine Playground · Laya",
    description: "Typed decisions with calibrated probabilities in a single forward pass. Playground, API, and a guide to building your own decision model.",
    images: ["/art/hero.webp"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
