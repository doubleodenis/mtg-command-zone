import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMatchById } from '@/lib/services'
import { getActiveDecks } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MatchPreviewCard, InviteLinkButton } from '@/components/match'
import { AddToCollectionButton } from '@/components/match/add-to-collection-button'
import { Navbar } from '@/components/features/navbar'
import { ParticipantList } from './participant-list'
import type { MatchCardData, DeckSummary } from '@/types'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Bracket name mapping
const BRACKET_NAMES: Record<number, string> = {
  1: 'Beginner',
  2: 'Casual',
  3: 'Upgraded',
  4: 'cEDH',
}

function getAverageBracket(match: MatchCardData): number {
  const brackets: number[] = []
  for (const p of match.participants) {
    if (p.deck?.bracket != null) {
      brackets.push(p.deck.bracket)
    }
  }
  if (brackets.length === 0) return 2
  const avg = brackets.reduce((a, b) => a + b, 0) / brackets.length
  return Math.round(avg)
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function MatchDetailsPage({ params }: PageProps) {
  const { id: matchId } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch match, user's decks, and match creator info in parallel
  const [matchResult, userDecksResult, matchCreatorResult] = await Promise.all([
    getMatchById(supabase, matchId, user?.id),
    user ? getActiveDecks(supabase, user.id) : Promise.resolve({ success: true as const, data: [] }),
    supabase.from('matches').select('created_by').eq('id', matchId).single(),
  ])
  
  if (!matchResult.success) {
    notFound()
  }
  
  const match = matchResult.data
  const userDecks: DeckSummary[] = userDecksResult.success 
    ? userDecksResult.data.map(d => ({
        id: d.id,
        commanderName: d.commanderName,
        partnerName: d.partnerName,
        deckName: d.deckName,
        colorIdentity: d.colorIdentity,
        bracket: d.bracket,
      }))
    : []
  
  // Determine if user is creator and if there are placeholder slots
  const isCreator = user && matchCreatorResult.data?.created_by === user.id
  const hasPlaceholderSlots = match.participants.some(p => p.userId === null)
    
  const avgBracket = getAverageBracket(match)
  
  const winners = match.participants.filter((p) => p.isWinner)
  const confirmedCount = match.participants.filter((p) => p.isConfirmed).length

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header */}
      <div className="border-b border-card-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-text-1">
                Match Details
              </h1>
              <p className="text-sm text-text-3 mt-1">
                {new Date(match.playedAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user && <AddToCollectionButton matchId={matchId} />}
              {isCreator && (
                <InviteLinkButton 
                  matchId={matchId} 
                  hasPlaceholderSlots={hasPlaceholderSlots} 
                />
              )}
              <Badge variant="accent">
                {match.formatSlug.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {match.participantCount} Players
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Match Preview Card - larger display */}
        <div className="pointer-events-none">
          <MatchPreviewCard match={match} showElo className="h-56" />
        </div>

        {/* Match Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Winner(s) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-text-3">Winner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {winners.map((winner) => (
                  <div key={winner.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-win" />
                    <span className="font-medium text-text-1">{winner.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Power Level */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-text-3">Power Level</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xl font-bold text-text-1">
                {BRACKET_NAMES[avgBracket] || `Bracket ${avgBracket}`}
              </span>
            </CardContent>
          </Card>

          {/* Confirmation Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-text-3">Confirmations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-text-1">
                  {confirmedCount}/{match.participantCount}
                </span>
                {match.isFullyConfirmed ? (
                  <Badge variant="win" className="text-xs">Verified</Badge>
                ) : (
                  <Badge variant="default" className="text-xs">Pending</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Participants Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <ParticipantList
              participants={match.participants.map((p) => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.avatarUrl,
                userId: p.userId,
                isWinner: p.isWinner,
                isConfirmed: p.isConfirmed,
                ratingDelta: p.ratingDelta,
                deck: p.deck ? {
                  id: p.deck.id,
                  commanderName: p.deck.commanderName,
                  deckName: p.deck.deckName,
                  bracket: p.deck.bracket,
                } : null,
              }))}
              currentUserId={user?.id ?? null}
              userDecks={userDecks}
            />
          </CardContent>
        </Card>

        {/* Match Notes (placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-3 italic">No notes for this match.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
