import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { MatchPreviewCard } from '@/components/match/match-preview-card'
import { Navbar } from '@/components/features/navbar'
import { createMockMatchCardData, resetMockIds } from '@/lib/mock'
import type { FormatSlug, MatchCardData } from '@/types'

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

// Simple hash function to get deterministic number from string
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Generate mock data for a specific match ID (deterministic)
function getMockMatch(matchId: string): MatchCardData {
  // Reset IDs so they're consistent
  resetMockIds()
  
  const hash = hashString(matchId)
  const formats: FormatSlug[] = ['ffa', '1v1', '2v2', 'pentagram']
  const format = formats[hash % formats.length]
  
  const playerCounts: Record<FormatSlug, number> = {
    ffa: 4,
    '1v1': 2,
    '2v2': 4,
    '3v3': 6,
    pentagram: 5,
  }
  
  const count = playerCounts[format]
  const winnerIndex = hash % count
  
  return createMockMatchCardData(count, {
    id: matchId,
    formatSlug: format,
    formatName: format === 'ffa' ? 'Free for All' : format.toUpperCase(),
    winnerNames: [`Player ${winnerIndex + 1}`],
  })
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function MatchDetailsPage({ params }: PageProps) {
  const { id: matchId } = await params
  
  // For now, use mock data
  const match = getMockMatch(matchId)
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
            <div className="space-y-3">
              {match.participants.map((participant, index) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between py-3 border-b border-card-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-3 w-6">#{index + 1}</span>
                    <Avatar
                      src={participant.avatarUrl}
                      alt={participant.name}
                      fallback={participant.name}
                      size="lg"
                    />
                    <div>
                      <p className="font-medium text-text-1">{participant.name}</p>
                      {participant.deck && (
                        <p className="text-sm text-text-3">
                          {participant.deck.commanderName || 'Unknown Commander'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {participant.isWinner && (
                      <Badge variant="win">Winner</Badge>
                    )}
                    {participant.isConfirmed ? (
                      <Badge variant="outline" className="text-text-3">Confirmed</Badge>
                    ) : (
                      <Badge variant="default">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
