import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMatchByInviteToken } from '@/app/actions/match'
import { Navbar } from '@/components/features/navbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormatBadge } from '@/components/ui/format-badge'
import { ClaimSlotForm } from './claim-slot-form'
import type { FormatSlug } from '@/types'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ token: string }>
}

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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-500"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
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

  const { match, placeholderSlots, isExpired, isUsed: _isUsed } = result.data

  // Check for expired token
  if (isExpired) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl md:mx-auto px-4 py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-yellow-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
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

  // Check if all slots are already claimed
  const availableSlots = placeholderSlots.filter(s => s.claimStatus === 'none')
  const allSlotsClaimed = availableSlots.length === 0

  // Check if user is already in this match
  const { data: existingParticipant } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', match.id)
    .eq('user_id', user.id)
    .single()

  const isAlreadyParticipant = !!existingParticipant

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl md:mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text-1">
            Claim Your Spot
          </h1>
          <p className="mt-1 text-text-2">
            You've been invited to claim a spot in this match
          </p>
        </div>

        {/* Match Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Match Details</CardTitle>
              <FormatBadge format={match.formatSlug as FormatSlug} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-3">Created by</span>
              <span className="text-text-1 font-medium">@{match.creatorUsername}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-3">Played</span>
              <span className="text-text-1">
                {new Date(match.playedAt).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-3">Players</span>
              <span className="text-text-1">{match.participantCount}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {isAlreadyParticipant ? (
          <Card className="mb-6 border-yellow-500/30 bg-yellow-500/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-yellow-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-yellow-500">Already in this match</p>
                  <p className="text-sm text-text-2 mt-1">
                    You are already a participant in this match.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : allSlotsClaimed ? (
          <Card className="mb-6 border-red-500/30 bg-red-500/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-red-500">No slots available</p>
                  <p className="text-sm text-text-2 mt-1">
                    All placeholder slots in this match have been claimed or are pending approval.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Claim Slots Section */}
        {!isAlreadyParticipant && !allSlotsClaimed && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Your Slot</CardTitle>
              <CardDescription>
                Choose which placeholder name represents you in this match
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClaimSlotForm 
                slots={placeholderSlots}
                matchId={match.id}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/match/${match.id}`}>View Match Details</Link>
          </Button>
          {(isAlreadyParticipant || allSlotsClaimed) && (
            <Button asChild>
              <Link href="/matches">Go to Matches</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
