import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getMatchByInviteToken } from '@/app/actions/match'
import { Navbar } from '@/components/features/navbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ token: string }>
}

/**
 * Claim page via invite token.
 * - Logged out users: redirected to login, then back here
 * - Logged in users: redirected to match detail page to claim their slot
 */
export default async function ClaimByTokenPage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()

  // Check auth status
  const { data: { user } } = await supabase.auth.getUser()

  // If not logged in, redirect to login with return URL
  if (!user) {
    redirect(`/login?redirectTo=/claim/${token}`)
  }

  // Validate the token and get match details
  const result = await getMatchByInviteToken(token)

  if (!result.success) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl md:mx-auto px-4 py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <CardTitle className="text-xl">Invalid Invite Link</CardTitle>
              <CardDescription>
                This invite link is invalid or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/matches/claim">Search for Matches</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { match, isExpired } = result.data

  // Check for expired token
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl md:mx-auto px-4 py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <CardTitle className="text-xl">Invite Link Expired</CardTitle>
              <CardDescription>
                This invite link has expired. Ask the match creator for a new link.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/matches/claim">Search for Matches</Link>
              </Button>
              <Button asChild>
                <Link href="/matches">View Your Matches</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Redirect logged-in users to the match detail page to claim their slot
  redirect(`/match/${match.id}`)
}
