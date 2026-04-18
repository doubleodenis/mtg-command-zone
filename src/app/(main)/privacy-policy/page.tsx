import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacy Policy"
        description="How CommandZone handles account, match, and activity data."
      />

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-text-2">
          <p>
            CommandZone stores only the data needed to provide match tracking, ratings, collections,
            and social features.
          </p>
          <p>
            By using the app, you understand that match results, player profiles, and related rating
            history may be visible according to product visibility rules (for example, public player
            profiles and collection visibility settings).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data We Store</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-text-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information from authentication providers (for sign-in and identity).</li>
            <li>Profile data you provide, such as username and optional avatar.</li>
            <li>Match data, participant slots, deck selections, confirmations, and ratings history.</li>
            <li>Collection membership, permissions, and match approval activity.</li>
            <li>Notification records needed for claims, confirmations, and requests.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Data Is Used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-text-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>To run core features like match logging, rating updates, and social workflows.</li>
            <li>To display dashboards, leaderboards, history charts, and profile statistics.</li>
            <li>To support moderation and auditability through immutable rating history.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access and Visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-text-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Player profiles and match details may be publicly visible as defined by the product.</li>
            <li>Private collections are not visible to non-members.</li>
            <li>Owner-only actions remain restricted by collection and match ownership rules.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Third-Party Content & Intellectual Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-text-2">
          <p>
            CommandZone is unofficial Fan Content permitted under the Fan Content Policy. Not
            approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
            the Coast. ©Wizards of the Coast LLC.
          </p>
          <p>
            Magic: The Gathering, including card names, card art, mana symbols, and related imagery,
            are trademarks of Wizards of the Coast LLC. All card images displayed in this application
            are sourced from Scryfall and are the property of Wizards of the Coast.
          </p>
          <div className="pt-2 border-t border-border-1">
            <p className="text-text-3 text-xs font-medium uppercase tracking-wider mb-1">
              Background Art Credit
            </p>
            <p>
              &quot;Storm of Saruman&quot; illustration by Livia Prima © Wizards of the Coast.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-text-2">
        This page is a product-level policy summary and can be updated as legal requirements evolve.
      </p>
    </div>
  );
}
