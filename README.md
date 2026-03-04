# MTG Commander Match Tracker

A NextJS web application for tracking Magic: The Gathering Commander matches with friends. Features a Steam-like friend system, match history, statistics, and public player profiles.

## Features

- **Public Player Profiles** - Search and view any player's match history and stats
- **Match Tracking** - Record 1v1, 2v2, and multiplayer Commander matches
- **Commander Collection** - Track your favorite commanders with Scryfall integration
- **Friend System** - Add friends via request/accept model
- **Groups** - Organize tournaments or playgroups
- **Statistics** - Win rates, top commanders, match history charts

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Auth)
- **APIs:** Scryfall (commander card data)
- **Deployment:** Netlify

---

## Setup Checklist

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd mtg-game-tracker
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Enter project details:
   - **Name:** mtg-commander-tracker (or your preferred name)
   - **Database Password:** Generate a strong password and save it
   - **Region:** Choose closest to your users
4. Wait for project to provision (~2 minutes)

### 3. Get Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (safe to expose in browser)

### 4. Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 5. Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the editor and click **Run**
5. Verify tables were created in **Table Editor**

Expected tables:
- `profiles`
- `user_commanders`
- `friendships`
- `groups`
- `group_members`
- `matches`
- `match_participants`
- `guest_participants`

### 6. Configure OAuth Providers

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure consent screen if prompted
6. Select **Web application**
7. Add authorized redirect URI:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
8. Copy **Client ID** and **Client Secret**
9. In Supabase: **Authentication** → **Providers** → **Google**
10. Enable and paste your credentials

#### Discord OAuth

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Go to **OAuth2** → **General**
4. Add redirect:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
5. Copy **Client ID** and **Client Secret**
6. In Supabase: **Authentication** → **Providers** → **Discord**
7. Enable and paste your credentials

### 7. Configure Auth Redirect URLs

In Supabase dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (dev) or your production URL
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback`

### 8. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Deployment (Netlify)

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Connect to Netlify

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click **Add new site** → **Import an existing project**
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Install Netlify Next.js Plugin

The plugin should auto-detect, but verify in `netlify.toml` or site settings.

### 4. Update Supabase Auth URLs

1. Add your Netlify domain to Supabase redirect URLs:
   ```
   https://your-site.netlify.app/auth/callback
   ```
2. Update **Site URL** to production URL

### 5. Update OAuth Providers

Add your Netlify domain as an authorized redirect in:
- Google Cloud Console
- Discord Developer Portal

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/callback/      # OAuth callback handler
│   ├── dashboard/          # Protected dashboard pages
│   │   ├── commanders/     # Commander collection
│   │   ├── friends/        # Friend management
│   │   ├── groups/         # Group/tournament management
│   │   ├── matches/new/    # Create new match
│   │   └── settings/       # Profile settings
│   ├── login/              # Login page
│   ├── match/[id]/         # Public match detail
│   └── player/[username]/  # Public player profile
├── components/
│   ├── ui/                 # Reusable UI components
│   └── ...                 # Feature components
├── lib/
│   ├── supabase/           # Supabase client setup
│   ├── scryfall/           # Scryfall API integration
│   └── utils.ts            # Utility functions
└── types/
    └── database.types.ts   # Supabase TypeScript types
```

---

## Optional Enhancements

- [ ] Add profile image upload (Supabase Storage)
- [ ] Email notifications for friend requests
- [ ] Match reminders/scheduling
- [ ] Advanced statistics & charts
- [ ] Mobile app with React Native
- [ ] Match comments/notes
- [ ] Deck list integration
- [ ] Elo/rating system

---

## Troubleshooting

### "Invalid API key" error
- Verify your `.env.local` values match Supabase dashboard
- Restart the dev server after changing env vars

### OAuth redirect errors
- Ensure redirect URLs match exactly (trailing slashes matter)
- Check both Supabase and OAuth provider settings

### Database permission errors
- Verify RLS policies were created from migration
- Check user is authenticated for protected operations

### Styles not loading
- Clear `.next` folder: `rm -rf .next`
- Restart dev server

---

## License

MIT
