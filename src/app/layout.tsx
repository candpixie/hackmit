import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Insta Insights",
  description:
    "The friendships you're about to lose, and the one message that gets them back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions write attributes onto <html> before React loads,
    // which React then reports as a hydration mismatch it cannot fix.
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <body className="relative">
        <div className="relative z-10">
          <TopBar />
          {children}
        </div>
      </body>
    </html>
  );
}
