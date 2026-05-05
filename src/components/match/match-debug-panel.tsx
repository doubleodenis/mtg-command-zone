'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type RatingHistoryDetail = {
  rating_before: number
  rating_after: number
  delta: number
  player_bracket_recorded: number
  opponent_avg_bracket: number
  k_factor: number
}

type ParticipantDetail = {
  participant_id: string
  user_id: string | null
  deck_id: string | null
  deck_name: string
  deck_bracket_current: number | null
  is_winner: boolean
  confirmed: boolean
  rating_history: RatingHistoryDetail | null
  bracket_mismatch: boolean
}

type MatchDebugInfo = {
  match: {
    id: string
    format: { name: string; slug: string }
    played_at: string
    is_dirty: boolean
    ratings_applied_at: string | null
  }
  participants: ParticipantDetail[]
  has_bracket_mismatch: boolean
  rating_history_count: number
}

type RecalcResult = {
  match_id: string
  success: boolean
  participants_updated: number
  error?: string
  details?: Array<{
    user_id: string
    old_delta: number
    new_delta: number
    delta_change: number
    bracket_used: number
  }>
}

type Props = {
  matchId: string
  isDirty: boolean
  ratingsAppliedAt: string | null
}

export function MatchDebugPanel({ matchId, isDirty, ratingsAppliedAt }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<MatchDebugInfo | null>(null)
  const [recalcResult, setRecalcResult] = useState<RecalcResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const fetchDebugInfo = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debug/recalculate?id=${matchId}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch debug info')
      }
      const data = await res.json()
      setDebugInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const triggerRecalc = async () => {
    setIsLoading(true)
    setError(null)
    setRecalcResult(null)
    try {
      const res = await fetch(`/api/debug/recalculate?id=${matchId}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to trigger recalculation')
      }
      const data = await res.json()
      if (data.results && data.results.length > 0) {
        setRecalcResult(data.results[0])
      }
      // Refresh debug info after recalc
      await fetchDebugInfo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = () => {
    if (!isExpanded && !debugInfo) {
      fetchDebugInfo()
    }
    setIsExpanded(!isExpanded)
  }

  return (
    <Card className="border-dashed border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-yellow-500 flex items-center gap-2">
            🐛 Debug Panel
            <Badge variant="outline" className="text-xs">
              DEV ONLY
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="text-yellow-500 hover:text-yellow-400"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Quick Status */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={isDirty ? 'accent' : 'outline'}>
              is_dirty: {isDirty ? 'true' : 'false'}
            </Badge>
            <Badge variant={ratingsAppliedAt ? 'win' : 'outline'}>
              ratings_applied: {ratingsAppliedAt ? 'yes' : 'no'}
            </Badge>
            {debugInfo?.has_bracket_mismatch && (
              <Badge variant="loss">
                ⚠️ BRACKET MISMATCH DETECTED
              </Badge>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              Error: {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-text-3 text-sm">Loading...</div>
          )}

          {/* Debug Info */}
          {debugInfo && !isLoading && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-text-2">Participants & Rating History</h4>
              <div className="space-y-2">
                {debugInfo.participants.map((p) => (
                  <div
                    key={p.participant_id}
                    className={`p-2 rounded border text-xs font-mono ${
                      p.bracket_mismatch
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-card-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-2">{p.deck_name}</span>
                      {p.is_winner && <Badge variant="win" className="text-xs">W</Badge>}
                      {p.bracket_mismatch && (
                        <Badge variant="loss" className="text-xs">MISMATCH</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-text-3">
                      <div>Current bracket: <span className="text-text-1">{p.deck_bracket_current ?? 'null'}</span></div>
                      <div>Recorded bracket: <span className="text-text-1">{p.rating_history?.player_bracket_recorded ?? 'N/A'}</span></div>
                      {p.rating_history && (
                        <>
                          <div>Rating: <span className="text-text-1">{p.rating_history.rating_before} → {p.rating_history.rating_after}</span></div>
                          <div>Delta: <span className={p.rating_history.delta >= 0 ? 'text-win' : 'text-loss'}>
                            {p.rating_history.delta >= 0 ? '+' : ''}{p.rating_history.delta}
                          </span></div>
                          <div>Opp avg bracket: <span className="text-text-1">{p.rating_history.opponent_avg_bracket.toFixed(2)}</span></div>
                          <div>K-factor: <span className="text-text-1">{p.rating_history.k_factor}</span></div>
                        </>
                      )}
                      {!p.rating_history && (
                        <div className="col-span-2 text-text-3 italic">No rating history</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recalc Result */}
          {recalcResult && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-2">Recalculation Result</h4>
              <div className={`p-2 rounded border text-xs ${
                recalcResult.success
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-red-500/50 bg-red-500/10'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={recalcResult.success ? 'win' : 'loss'}>
                    {recalcResult.success ? 'SUCCESS' : 'FAILED'}
                  </Badge>
                  <span className="text-text-3">
                    {recalcResult.participants_updated} participants updated
                  </span>
                </div>
                {recalcResult.error && (
                  <div className="text-red-400">{recalcResult.error}</div>
                )}
                {recalcResult.details && recalcResult.details.length > 0 && (
                  <div className="mt-2 space-y-1 font-mono">
                    {recalcResult.details.map((d, i) => (
                      <div key={i} className="text-text-3">
                        bracket={d.bracket_used}: delta {d.old_delta} → {d.new_delta} 
                        <span className={d.delta_change !== 0 ? 'text-yellow-400' : 'text-text-3'}>
                          {' '}({d.delta_change >= 0 ? '+' : ''}{d.delta_change})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-card-border">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDebugInfo}
              disabled={isLoading}
            >
              Refresh Info
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={triggerRecalc}
              disabled={isLoading || !isDirty}
              className="bg-yellow-600 hover:bg-yellow-500"
            >
              {isLoading ? 'Running...' : 'Run Recalc Now'}
            </Button>
            {!isDirty && (
              <span className="text-xs text-text-3 self-center">
                (Match not dirty - nothing to recalculate)
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
