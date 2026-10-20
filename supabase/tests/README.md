# SQL check scripts

Manual verification scripts for migrations whose behaviour lives in SQL.
Each runs inside a transaction that is rolled back, so it leaves no data
behind. Run them against a **local** database only:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -q -t -f supabase/tests/<file>.check.sql
```

Each file's comments and printed labels state the expected result. They are
not wired into CI yet.
