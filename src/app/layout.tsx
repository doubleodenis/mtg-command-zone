import type { Metadata } from "next";
import { Suspense } from "react";
import { Barlow, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/footer";
import { DisplayNameSetupModal } from "@/components/features/display-name-setup-modal";

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

  // Fetch profile for display name check (only if logged in)
  let profile: { display_name: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <html lang="en" className="dark">
      <body className={`${barlow.variable} ${chakraPetch.variable} ${jetbrainsMono.variable} font-body antialiased bg-bg-base text-text-1 min-h-screen flex flex-col`}>
        <Providers userId={user?.id}>
          <div className="flex-1 flex flex-col bg-black/30 backdrop-blur-[2px]">
            {children}
          </div>
          <Footer />
          {user && (
            <Suspense fallback={null}>
              <DisplayNameSetupModal
                userId={user.id}
                currentDisplayName={profile?.display_name ?? null}
              />
            </Suspense>
          )}
        </Providers>
      </body>
    </html>
  );
}
