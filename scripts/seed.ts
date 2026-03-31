/**
 * Database Seed Script
 *
 * Populates the database with test data using mock factories.
 * Run with: npx tsx scripts/seed.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'
import type { TablesInsert } from '../src/types/database.types'

// Load environment variables from .env.local
config({ path: '.env.local' })

// ============================================
// Configuration
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ============================================
// Mock Data
// ============================================

const MOCK_USERNAMES = [
  'arcane_mage',
  'dragon_slayer',
  'planeswalker99',
  'mtg_master',
  'commander_chad',
  'spell_slinger',
  'mana_dork',
  'counter_magic',
]

const MOCK_COMMANDERS = [
  { name: "Atraxa, Praetors' Voice", colors: ['W', 'U', 'B', 'G'] },
  { name: 'Edgar Markov', colors: ['W', 'B', 'R'] },
  { name: 'Korvold, Fae-Cursed King', colors: ['B', 'R', 'G'] },
  { name: "Yuriko, the Tiger's Shadow", colors: ['U', 'B'] },
  { name: 'Kenrith, the Returned King', colors: ['W', 'U', 'B', 'R', 'G'] },
  { name: 'Krenko, Mob Boss', colors: ['R'] },
  { name: 'Urza, Lord High Artificer', colors: ['U'] },
  { name: 'Meren of Clan Nel Toth', colors: ['B', 'G'] },
]

// ============================================
// Seed Functions
// ============================================

async function clearData() {
  console.log('Clearing existing data...')

  // Delete in reverse dependency order
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('rating_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('ratings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('collection_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('collection_members').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('collections').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('match_participants').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('decks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('friends').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // Don't delete profiles - they're linked to auth.users

  console.log('Data cleared.')
}

async function seedFormats() {
  console.log('Seeding formats...')

  // Formats are seeded by the migration, verify they exist
  const { data: formats, error } = await supabase.from('formats').select('*')

  if (error) {
    console.error('Error fetching formats:', error)
    return []
  }

  console.log(`Found ${formats?.length ?? 0} formats`)
  return formats ?? []
}

async function seedProfiles() {
  console.log('Seeding profiles...')

  // Get existing auth users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('Error fetching auth users:', authError)
    return []
  }

  // Create profiles for any users that don't have one
  const profiles: TablesInsert<'profiles'>[] = []

  for (let i = 0; i < authUsers.users.length; i++) {
    const user = authUsers.users[i]
    const username = user.user_metadata?.username ?? MOCK_USERNAMES[i % MOCK_USERNAMES.length]

    profiles.push({
      id: user.id,
      username: `${username}_${i}`,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
    })
  }

  if (profiles.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profiles, { onConflict: 'id' })
      .select()

    if (error) {
      console.error('Error seeding profiles:', error)
      return []
    }

    console.log(`Seeded ${data?.length ?? 0} profiles`)
    return data ?? []
  }

  // If no auth users, we can't create profiles (they need auth.users FK)
  console.log('No auth users found. Create users via signup first.')
  return []
}

async function seedDecks(profileIds: string[]) {
  console.log('Seeding decks...')

  if (profileIds.length === 0) {
    console.log('No profiles to seed decks for')
    return []
  }

  const decks: TablesInsert<'decks'>[] = []

  // Create 2-3 decks per profile
  for (const profileId of profileIds) {
    const deckCount = Math.floor(Math.random() * 2) + 2 // 2-3 decks

    for (let i = 0; i < deckCount; i++) {
      const commander = MOCK_COMMANDERS[Math.floor(Math.random() * MOCK_COMMANDERS.length)]

      decks.push({
        owner_id: profileId,
        commander_name: commander.name,
        partner_name: null,
        deck_name: `${commander.name.split(',')[0]} Deck`,
        color_identity: commander.colors,
        bracket: Math.floor(Math.random() * 4) + 1, // 1-4
        is_active: true,
      })
    }
  }

  const { data, error } = await supabase.from('decks').insert(decks).select()

  if (error) {
    console.error('Error seeding decks:', error)
    return []
  }

  console.log(`Seeded ${data?.length ?? 0} decks`)
  return data ?? []
}

async function seedFriendships(profileIds: string[]) {
  console.log('Seeding friendships...')

  if (profileIds.length < 2) {
    console.log('Not enough profiles for friendships')
    return []
  }

  const friends: TablesInsert<'friends'>[] = []

  // Create some accepted friendships
  for (let i = 0; i < profileIds.length - 1; i++) {
    friends.push({
      requester_id: profileIds[i],
      addressee_id: profileIds[i + 1],
      status: 'accepted',
    })
  }

  // Add a pending friendship
  if (profileIds.length > 2) {
    friends.push({
      requester_id: profileIds[profileIds.length - 1],
      addressee_id: profileIds[0],
      status: 'pending',
    })
  }

  const { data, error } = await supabase.from('friends').insert(friends).select()

  if (error) {
    console.error('Error seeding friendships:', error)
    return []
  }

  console.log(`Seeded ${data?.length ?? 0} friendships`)
  return data ?? []
}

async function seedCollections(profileIds: string[]) {
  console.log('Seeding collections...')

  if (profileIds.length === 0) {
    console.log('No profiles to seed collections for')
    return []
  }

  const collections: TablesInsert<'collections'>[] = [
    {
      owner_id: profileIds[0],
      name: 'Friday Night Pod',
      description: 'Weekly Friday night games',
      is_public: true,
      match_add_permission: 'any_member',
    },
    {
      owner_id: profileIds[0],
      name: 'Summer League 2024',
      description: 'Competitive summer tournament',
      is_public: true,
      match_add_permission: 'any_member_approval_required',
    },
  ]

  if (profileIds.length > 1) {
    collections.push({
      owner_id: profileIds[1],
      name: 'Casual Games',
      description: 'Low-power casual matches',
      is_public: false,
      match_add_permission: 'any_member',
    })
  }

  const { data, error } = await supabase.from('collections').insert(collections).select()

  if (error) {
    console.error('Error seeding collections:', error)
    return []
  }

  console.log(`Seeded ${data?.length ?? 0} collections`)

  // Add members to collections
  if (data && data.length > 0 && profileIds.length > 1) {
    const members: TablesInsert<'collection_members'>[] = []

    for (const collection of data) {
      // Owner is automatically a member
      members.push({
        collection_id: collection.id,
        user_id: collection.owner_id,
        role: 'owner',
      })

      // Add other profiles as members
      for (const profileId of profileIds) {
        if (profileId !== collection.owner_id) {
          members.push({
            collection_id: collection.id,
            user_id: profileId,
            role: 'member',
          })
        }
      }
    }

    const { error: memberError } = await supabase.from('collection_members').insert(members)

    if (memberError) {
      console.error('Error seeding collection members:', memberError)
    } else {
      console.log(`Seeded ${members.length} collection members`)
    }
  }

  return data ?? []
}

async function seedMatches(
  profileIds: string[],
  decksByOwner: Map<string, { id: string; bracket: number }[]>,
  formatIds: string[],
  collectionIds: string[]
) {
  console.log('Seeding matches...')

  if (profileIds.length < 2 || formatIds.length === 0) {
    console.log('Not enough data to seed matches')
    return []
  }

  const matches: TablesInsert<'matches'>[] = []
  const ffaFormatId = formatIds.find((_, i) => i === 3) ?? formatIds[0] // FFA is index 3

  // Create 10 FFA matches
  for (let i = 0; i < 10; i++) {
    const daysAgo = Math.floor(Math.random() * 30)
    const playedAt = new Date()
    playedAt.setDate(playedAt.getDate() - daysAgo)

    matches.push({
      created_by: profileIds[Math.floor(Math.random() * profileIds.length)],
      format_id: ffaFormatId,
      played_at: playedAt.toISOString(),
      notes: i % 3 === 0 ? 'Great game!' : null,
      match_data: { format: 'ffa' },
    })
  }

  const { data, error } = await supabase.from('matches').insert(matches).select()

  if (error) {
    console.error('Error seeding matches:', error)
    return []
  }

  console.log(`Seeded ${data?.length ?? 0} matches`)

  // Add participants to each match
  if (data) {
    for (const match of data) {
      const participantCount = 4
      const participants: TablesInsert<'match_participants'>[] = []
      const winnerIndex = Math.floor(Math.random() * participantCount)

      // Shuffle profiles and pick participants
      const shuffledProfiles = [...profileIds].sort(() => Math.random() - 0.5)
      const matchProfiles = shuffledProfiles.slice(0, Math.min(participantCount, shuffledProfiles.length))

      for (let i = 0; i < matchProfiles.length; i++) {
        const profileId = matchProfiles[i]
        const decks = decksByOwner.get(profileId) ?? []
        const deck = decks[Math.floor(Math.random() * decks.length)]
        const isCreator = profileId === match.created_by

        participants.push({
          match_id: match.id,
          user_id: profileId,
          deck_id: deck?.id ?? null,
          is_winner: i === winnerIndex,
          confirmed_at: isCreator ? new Date().toISOString() : null, // Creator auto-confirmed
          claim_status: 'none',
          participant_data: { format: 'ffa' },
        })
      }

      // Add a placeholder participant occasionally
      if (Math.random() > 0.7) {
        participants.push({
          match_id: match.id,
          user_id: null,
          placeholder_name: 'Guest Player',
          deck_id: null,
          is_winner: false,
          confirmed_at: null,
          claim_status: 'none',
          participant_data: { format: 'ffa' },
        })
      }

      const { error: pError } = await supabase.from('match_participants').insert(participants)

      if (pError) {
        console.error('Error seeding participants for match:', match.id, pError)
      }
    }

    console.log('Seeded match participants')

    // Add some matches to collections
    if (collectionIds.length > 0) {
      const collectionMatches: TablesInsert<'collection_matches'>[] = []

      for (let i = 0; i < Math.min(5, data.length); i++) {
        collectionMatches.push({
          collection_id: collectionIds[0],
          match_id: data[i].id,
          added_by: data[i].created_by,
          approval_status: 'approved',
        })
      }

      const { error: cmError } = await supabase.from('collection_matches').insert(collectionMatches)

      if (cmError) {
        console.error('Error seeding collection matches:', cmError)
      } else {
        console.log(`Added ${collectionMatches.length} matches to collections`)
      }
    }
  }

  return data ?? []
}

async function seedRatings(profileIds: string[], formatIds: string[]) {
  console.log('Seeding ratings...')

  if (profileIds.length === 0 || formatIds.length === 0) {
    console.log('No data to seed ratings')
    return []
  }

  const ratings: TablesInsert<'ratings'>[] = []

  // Create global ratings for each profile/format combo
  for (const profileId of profileIds) {
    for (const formatId of formatIds) {
      const baseRating = 1000 + Math.floor(Math.random() * 400) - 200 // 800-1200
      const matchesPlayed = Math.floor(Math.random() * 50) + 5
      const wins = Math.floor(matchesPlayed * (0.3 + Math.random() * 0.4)) // 30-70% win rate

      ratings.push({
        user_id: profileId,
        format_id: formatId,
        collection_id: null, // Global rating
        rating: baseRating,
        matches_played: matchesPlayed,
        wins,
      })
    }
  }

  const { data, error } = await supabase.from('ratings').insert(ratings).select()

  if (error) {
    console.error('Error seeding ratings:', error)
    return []
  }

  console.log(`Seeded ${data?.length ?? 0} ratings`)
  return data ?? []
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('Starting database seed...')
  console.log('================================')

  try {
    // Clear existing data (optional - comment out to append)
    // await clearData()

    // Seed in dependency order
    const formats = await seedFormats()
    const formatIds = formats.map((f) => f.id)

    const profiles = await seedProfiles()
    const profileIds = profiles.map((p) => p.id)

    const decks = await seedDecks(profileIds)
    const decksByOwner = new Map<string, { id: string; bracket: number }[]>()
    for (const deck of decks) {
      const existing = decksByOwner.get(deck.owner_id) ?? []
      existing.push({ id: deck.id, bracket: deck.bracket })
      decksByOwner.set(deck.owner_id, existing)
    }

    await seedFriendships(profileIds)

    const collections = await seedCollections(profileIds)
    const collectionIds = collections.map((c) => c.id)

    await seedMatches(profileIds, decksByOwner, formatIds, collectionIds)
    await seedRatings(profileIds, formatIds)

    console.log('================================')
    console.log('Seed complete!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }
}

main()
