import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeaderboardDemoCard } from "@/components/features/leaderboard-demo-card";
import { FeatureCards } from "@/components/features/feature-cards";

/**
 * Landing hero section with animated match demo.
 * Two-column layout: headline left, animated FFA result demo right.
 * Includes value props strip below.
 */
export function LandingHero() {
  return (
    <>
      {/* Hero Section */}
      <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        <div className="flex flex-col lg:flex-row lg:items-center">
          {/* Headline text */}
          <div className="space-y-6 lg:flex-1">
            <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-text-1 leading-tight">
              Track your Commander matches.
              <span className="block text-accent">Watch your rating grow.</span>
            </h1>
            <p className="text-lg text-text-2 max-w-md">
              CommandZone is the competitive stat tracker for Magic: The Gathering
              Commander. Log matches, manage decks, and compete with your
              playgroup.
            </p>
            {/* CTA buttons - hidden on mobile, shown on desktop */}
            <div className="hidden lg:flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/login?mode=signup">Get Started</Link>
              </Button>
            </div>
          </div>

          {/* Animated Demo */}
          <div className="flex-1 max-w-full lg:max-w-none">
            <LeaderboardDemoCard />
          </div>
        </div>
        {/* CTA buttons - shown on mobile after feature cards */}
        <div className="lg:hidden flex flex-wrap gap-4">
          <Button asChild size="lg">
            <Link href="/login?mode=signup">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Feature Cards - desktop only (full width below hero) */}
      <div>
        <FeatureCards />
      </div>
    </>
  );
}
