# Supabase Seeds

Modular seed files for local development.

## Structure

- `users.sql` - Test users and profiles
- `decks.sql` - Sample commander decks
- `matches.sql` - Sample matches and collections

## Usage

The main `../seed.sql` file contains all seed data combined. These modular files are for reference and easier editing.

To apply seeds, run:
```bash
supabase db reset
```

## Test Credentials

| Email | Password | Username | Display Name |
|-------|----------|----------|--------------|
| player1@gmail.com | password123 | player1 | Player One |
| player2@gmail.com | password123 | player2 | Player Two |

## Adding New Seeds

1. Create a new `.sql` file in this folder
2. Copy the content into `../seed.sql` (Supabase only runs the main seed.sql)
3. Ensure proper `ON CONFLICT` handling for idempotency
