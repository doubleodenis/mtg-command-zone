import type { Metadata } from "next";
import { Barlow, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/footer";

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-data',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "CommandZone — Commander Tracker",
  description: "Track your Magic: The Gathering Commander matches, stats, and compete with friends",
  keywords: ["MTG", "Magic The Gathering", "Commander", "EDH", "match tracker", "stats"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className="dark">
      <body className={`${barlow.variable} ${chakraPetch.variable} ${jetbrainsMono.variable} font-body antialiased bg-bg-base text-text-1 min-h-screen`}>
        <Providers userId={user?.id}>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
