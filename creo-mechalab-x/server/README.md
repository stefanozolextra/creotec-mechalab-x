# Server Notes

## Database Sanity Checks (Read-Only)

These checks verify Phase 1 account safety rules (admin/trainee separation) and do not modify application data.

### Run SQL sanity checks via `psql`

From the repository root:

```bash
psql "$DATABASE_URL" -f "mechalabx-db/db/99_sanity_checks.sql"
```

Or using explicit connection params:

```bash
psql "postgresql://creotec_user:creotec_pass_ChangeMe@localhost:5433/mechalabx_db" \
  -f "mechalabx-db/db/99_sanity_checks.sql"
```

The script raises an exception on any critical violation and exits non-zero.

### Run Node sanity checks via npm

From `server/`:

```bash
npm run sanity:db
```

This prints a PASS/FAIL report and exits with status code `1` on failure.
