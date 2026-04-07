import Link from "next/link";
import { PageHeader, Section } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FaqPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="FAQ"
        description="How the core systems work: ratings, match claims, collections, and placeholders."
      />

      <Section title="RATINGS">
        <Card>
          <CardHeader>
            <CardTitle>How is rating calculated?</CardTitle>
            <CardDescription>
              Ratings use one expected-score model for every format and table size.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-text-2">
            <p className="text-text-1">
              Formula: <span className="font-data">Δ Rating = K × (Actual − Expected) × BracketModifier</span>
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="text-text-1">Actual:</span> 1 for a win, 0 for a loss.</li>
              <li><span className="text-text-1">Expected:</span> win probability from table ratings using rating factors: <span className="font-data">10^(rating/400)</span>.</li>
              <li><span className="text-text-1">K Factor:</span> 32 (0-20 matches), 24 (21-50), 16 (51+).</li>
              <li><span className="text-text-1">Bracket Modifier:</span> <span className="font-data">1 + sign(gap) × |gap|^1.5 × 0.12</span>, where <span className="font-data">gap = avgOpponentBracket − playerBracket</span>.</li>
            </ul>

            <div className="rounded-md border border-card-border bg-bg-overlay p-4 space-y-2">
              <p className="font-medium text-text-1">Worked example (4-player FFA)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Player rating: 1000, opponents: 1100 / 950 / 900.</li>
                <li>Player bracket: 2, opponent average bracket: 2.67.</li>
                <li>Player has 10 confirmed matches, so K = 32.</li>
                <li>
                  Expected ≈ 0.244 (from rating-factor share at the table).
                </li>
                <li>
                  Bracket modifier ≈ 1.07 (gap = 0.67).
                </li>
                <li>
                  If player wins: <span className="font-data">Δ ≈ 32 × (1 - 0.244) × 1.07 = +26</span> (rounded).
                </li>
              </ul>
            </div>

            <p>
              Pentagram note: expected score and bracket averaging include all 5 players, not just designated enemies.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section title="CLAIMS">
        <Card>
          <CardHeader>
            <CardTitle>How do I claim a match if I was added as a placeholder?</CardTitle>
            <CardDescription>
              Claims convert a guest slot to your account after creator approval. Three ways to claim:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-text-2">
            <div className="space-y-3">
              <div>
                <p className="font-medium text-text-1">1. Via Registration Link (Fastest)</p>
                <p className="text-sm text-text-2 mb-2">The match creator can generate and share an invite token.</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Click the invite link (format: <span className="font-data">/claim/token123</span>).</li>
                  <li>Select your placeholder name from the list of guest slots.</li>
                  <li>Submit the claim. The creator will be notified to approve.</li>
                </ol>
              </div>

              <div className="border-t border-card-border pt-3">
                <p className="font-medium text-text-1">2. By Name Search</p>
                <p className="text-sm text-text-2 mb-2">Manual search if you don't have a link.</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>
                    Go to <Link href="/matches/claim" className="text-accent hover:text-accent-fill">/matches/claim</Link>.
                  </li>
                  <li>Enter your placeholder name as it appears in the match.</li>
                  <li>Click "Claim" on the correct slot.</li>
                  <li>The creator approves via notification.</li>
                </ol>
              </div>

              <div className="border-t border-card-border pt-3">
                <p className="font-medium text-text-1">3. Through Owner's Profile</p>
                <p className="text-sm text-text-2 mb-2">Discover claimable matches while browsing.</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Visit the match creator's public profile.</li>
                  <li>If matches have open guest slots, a banner says "X matches have open slots."</li>
                  <li>Click "View Matches."</li>
                  <li>Find your placeholder name and click "Claim."</li>
                </ol>
              </div>
            </div>

            <div className="rounded-md border border-card-border bg-bg-overlay p-4 space-y-2">
              <p className="text-text-1 font-medium">After Claiming</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Status becomes <span className="font-data">pending</span>.</li>
                <li>Creator approves or rejects.</li>
                <li>If approved, your account is linked to the slot.</li>
                <li>You can then confirm the match to apply your rating update.</li>
              </ol>
            </div>

            <p>
              Ratings are confirmation-gated, so no rating change applies to you until your own confirmation is complete.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section title="COLLECTIONS">
        <Card>
          <CardHeader>
            <CardTitle>How do collections and permissions work?</CardTitle>
            <CardDescription>
              Collections are named groups of matches with owner-controlled visibility and add rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-2">
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="text-text-1">Visibility:</span> public collections are viewable by anyone; private collections return 404 for non-members.</li>
              <li><span className="text-text-1">Owner controls:</span> only owner can change settings and manage members.</li>
              <li><span className="text-text-1">Match add permission:</span> owner-only, any-member, or any-member-with-owner-approval.</li>
              <li><span className="text-text-1">Participant rule:</span> only someone who participated in a match can add it to a collection.</li>
              <li><span className="text-text-1">Approval flow:</span> with approval-required mode, submissions are pending until owner decision.</li>
            </ul>
            <p>
              Confirming a match updates both global rating and every collection-scoped rating that match belongs to.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section title="PLACEHOLDER DECKS">
        <Card>
          <CardHeader>
            <CardTitle>How does the placeholder deck system work?</CardTitle>
            <CardDescription>
              Placeholder decks keep match logging unblocked when a commander is unknown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-2">
            <ol className="list-decimal pl-5 space-y-2">
              <li>At match creation, a slot can use the Unknown Deck placeholder.</li>
              <li>Later, a linked participant can update their own slot to the correct deck.</li>
              <li>Deck-based stats recalculate automatically after the update.</li>
            </ol>
            <p>
              This is designed to preserve quick match entry without losing long-term data quality.
            </p>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
