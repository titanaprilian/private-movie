# Safe schema changes

Read this when the ticket involves database schema changes (e.g. modifying `src/schema/index.ts` in the DB package).

1. Make the necessary TypeScript changes.
2. Run the command to generate the migration file locally (e.g. `bun run db:generate`).
3. **STOP** before applying anything to a real database. Do not run `db:push` or `db:migrate` against any database except your worktree's own isolated test database (TESTDB). Before running `db:migrate` for your integration tests, confirm that `DATABASE_URL` in your worktree's `.env` ends in TESTDB. If it does not, do not run it.
4. Include a note in your hand-back message reminding the user to review the generated `.sql` file for data loss (like dropped tables or columns) and to run `db:migrate` manually on their end.
5. If the user explicitly asks you to run `db:push`, **DO NOT RUN IT**. Warn them that it bypasses SQL generation and can lead to immediate dataset loss, and ask them if they want to run it themselves (which they can do safely because it will be interactive).
