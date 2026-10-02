/**
 * Rating Recalculation — the nightly job
 *
 * Rebuilds every rating by replaying all confirmed matches chronologically
 * (src/lib/rating-replay.ts) and swaps the result in with ONE atomic call to
 * apply_rating_replay (migration 030): either every row is replaced or none.
 *
 * Usage:
 *   npx tsx scripts/recalculate-ratings.ts              # always replay
 *   npx tsx scripts/recalculate-ratings.ts --if-dirty   # replay only if a match is dirty (nightly)
 *   npx tsx scripts/recalculate-ratings.ts --dry-run    # compute, print counts, write nothing
 *
 * Outside GitHub Actions, a non-dry run refuses any host other than
 * 127.0.0.1/localhost: production writes go through the workflow. Break-glass:
 * --confirm-host=<exact host of NEXT_PUBLIC_SUPABASE_URL>.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (from the environment,
 * or .env.local when run locally). The secret key is required: the swap is a
 * service-role-only maintenance operation.
 *
 * Exit code: 0 on success / nothing to do, 1 on any failure (so the GitHub
 * Action fails loudly).
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'
import { replayRatings, toReplayMatches } from '../src/lib/rating-replay'
import type { MatchReplayRow } from '../src/lib/rating-replay'
import {
  checkCompleteLoad,
  checkWriteTarget,
  diffRatings,
  targetHost,
  toHistoryPayload,
  toRatingsPayload,
} from '../src/lib/rating-replay-load'
import type { ReplayRatingRow } from '../src/lib/rating-replay'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY
const IF_DIRTY = process.argv.includes('--if-dirty')
const DRY_RUN = process.argv.includes('--dry-run')
const CONFIRM_HOST =
  process.argv.find((a) => a.startsWith('--confirm-host='))?.slice('--confirm-host='.length) ?? null
const IN_CI = process.env.GITHUB_ACTIONS === 'true'
const TRIGGERED_BY = process.env.GITHUB_ACTIONS ? 'github-action' : 'manual'
const PAGE = 1000

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.')
  process.exit(1)
}

// Say where we are pointed before touching anything (host only, never the key).
console.log(`Target: ${targetHost(SUPABASE_URL) ?? '(unparsable URL)'}${DRY_RUN ? ' (dry run)' : ''}`)
const targetProblem = checkWriteTarget(SUPABASE_URL, { dryRun: DRY_RUN, confirmHost: CONFIRM_HOST, inCI: IN_CI })
if (targetProblem) {
  console.error(`\n✖ ${targetProblem}`)
  process.exit(1)
}

// apply_rating_replay was added in migration 030; database.types.ts is
// regenerated from production, so it doesn't know it yet.
type ReplayRpc = {
  rpc(
    fn: 'apply_rating_replay',
    args: {
      p_ratings: ReturnType<typeof toRatingsPayload>
      p_history: ReturnType<typeof toHistoryPayload>
      p_clear_dirty_match_ids: string[]
      /** Confirmed participations the replay saw; the RPC re-counts under lock and refuses on mismatch */
      p_expected_confirmed: number
      p_triggered_by: string
    }
  ): Promise<{ data: number | null; error: { message: string } | null }>
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function fail(message: string): Promise<never> {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

async function loadAllMatches(): Promise<MatchReplayRow[]> {
  const rows: MatchReplayRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, format_id, played_at,
        match_participants ( id, user_id, is_winner, confirmed_at,
          deck:decks!match_participants_deck_id_fkey ( bracket ) ),
        collection_matches ( collection_id, approval_status )
      `)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return fail(`Failed to load matches: ${error.message}`)
    rows.push(...((data ?? []) as MatchReplayRow[]))
    if (!data || data.length < PAGE) return rows
  }
}

async function loadMembers(): Promise<Map<string, Set<string>>> {
  const members = new Map<string, Set<string>>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('collection_members')
      .select('collection_id, user_id')
      .order('collection_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return fail(`Failed to load collection_members: ${error.message}`)
    for (const m of data ?? []) {
      if (!members.has(m.collection_id)) members.set(m.collection_id, new Set())
      members.get(m.collection_id)!.add(m.user_id)
    }
    if (!data || data.length < PAGE) return members
  }
}

async function loadCurrentRatings(): Promise<ReplayRatingRow[]> {
  const rows: ReplayRatingRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ratings')
      .select('user_id, format_id, collection_id, rating, matches_played, wins')
      .gt('matches_played', 0)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return fail(`Failed to load current ratings: ${error.message}`)
    for (const r of data ?? []) {
      rows.push({
        userId: r.user_id,
        formatId: r.format_id,
        collectionId: r.collection_id,
        rating: r.rating,
        matchesPlayed: r.matches_played,
        wins: r.wins,
      })
    }
    if (!data || data.length < PAGE) return rows
  }
}

async function main() {
  const { data: dirty, error: dirtyError } = await supabase
    .from('matches')
    .select('id')
    .eq('is_dirty', true)
  if (dirtyError) return fail(`Failed to read dirty matches: ${dirtyError.message}`)
  const dirtyIds = (dirty ?? []).map((m) => m.id)

  if (IF_DIRTY && dirtyIds.length === 0) {
    console.log('No dirty matches — nothing to do.')
    return
  }

  const [matchRows, members] = await Promise.all([loadAllMatches(), loadMembers()])

  const { count: dbConfirmed, error: countError } = await supabase
    .from('match_participants')
    .select('id', { count: 'exact', head: true })
    .not('confirmed_at', 'is', null)
  if (countError) return fail(`Failed to count confirmed participations: ${countError.message}`)
  if (dbConfirmed === null) return fail('Failed to count confirmed participations: no count returned')
  const loadedConfirmed = matchRows.reduce(
    (n, m) => n + m.match_participants.filter((p) => p.confirmed_at !== null).length,
    0
  )
  const loadProblem = checkCompleteLoad(loadedConfirmed, dbConfirmed)
  if (loadProblem) return fail(loadProblem)

  const { ratings, history } = replayRatings(toReplayMatches(matchRows), members)
  console.log(
    `Replayed ${matchRows.length} matches → ${history.length} history rows, ` +
      `${ratings.length} rating rows; clearing ${dirtyIds.length} dirty flag(s).`
  )

  if (DRY_RUN) {
    const current = await loadCurrentRatings()
    const diff = diffRatings(current, ratings)
    console.log(`\nDry run — ${diff.length} rating(s) would change (largest first):`)
    for (const d of diff.slice(0, 50)) {
      const scope = d.collectionId ? `collection ${d.collectionId}` : 'global'
      console.log(`  ${d.userId}  ${d.formatId}  ${scope}: ${d.before ?? '—'} → ${d.after ?? '—'} (${d.change > 0 ? '+' : ''}${d.change})`)
    }
    if (diff.length > 50) console.log(`  … and ${diff.length - 50} more`)
    console.log('Nothing written.')
    return
  }

  // History stays in replayRatings' chronological order: the RPC derives
  // created_at from matches.played_at plus payload position.
  const { data: written, error } = await (supabase as unknown as ReplayRpc).rpc('apply_rating_replay', {
    p_ratings: toRatingsPayload(ratings),
    p_history: toHistoryPayload(history),
    p_clear_dirty_match_ids: dirtyIds,
    p_expected_confirmed: dbConfirmed,
    p_triggered_by: TRIGGERED_BY,
  })
  if (error) return fail(`apply_rating_replay failed (nothing was changed): ${error.message}`)
  console.log(`✔ Swapped in ${written ?? 0} history rows.`)
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
