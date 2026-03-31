import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ClaimSearchForm } from "./claim-search-form";

export default async function ClaimMatchPage() {
  const supabase = await createClient();

  // Check auth - redirect to login if not authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/matches/claim");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Claim Match Slot"
          description="Search for matches where you were added as a guest/placeholder"
        />
        <Button variant="outline" asChild>
          <Link href="/matches">Back to Matches</Link>
        </Button>
      </div>

      {/* How it works */}
      <div className="rounded-lg bg-surface-secondary border border-border p-4">
        <h3 className="font-medium text-text-primary mb-2">How it works</h3>
        <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
          <li>Search for your name as it appeared when the match was logged</li>
          <li>Find the match and click "Claim" to request ownership of that slot</li>
          <li>The match creator will be notified to approve your claim</li>
          <li>Once approved, you can confirm the match and your rating will update</li>
        </ol>
      </div>

      <ClaimSearchForm />
    </div>
  );
}
