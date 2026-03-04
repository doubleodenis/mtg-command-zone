import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MTG Commander Tracker",
  description: "Track your Magic: The Gathering Commander matches, stats, and compete with friends",
  keywords: ["MTG", "Magic The Gathering", "Commander", "EDH", "match tracker", "stats"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
