# Contributing to NEXUS Chess

Thanks for improving NEXUS. Keep changes focused, testable, and honest about their production readiness.

## Development setup

```bash
npm ci
npm run dev
```

Use Node.js `>=22.13.0`. The development and build scripts prepare the browser Stockfish files automatically.

## Branches and commits

- Branch from the latest `main`.
- Use `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, or `codex/<topic>`.
- Write an imperative subject that explains the outcome: `Improve rated room reconnect handling`.
- Keep refactors separate from behavior changes when practical.
- Never commit credentials, local databases, build output, `.env` files, or generated `public/stockfish/` files.

## Required checks

Run the complete local gate before requesting review:

```bash
npm run check
```

For database changes, also generate and inspect the migration:

```bash
npm run db:generate
```

## Pull requests

A pull request should include:

- a concise problem and solution summary;
- testing evidence and known limitations;
- screenshots or recordings for visible UI changes;
- a migration and rollback note for schema changes;
- updated contracts, documentation, and roadmap status where relevant;
- confirmation that chess legality, clocks, results, and rating idempotency remain correct.

Do not describe a prototype adapter as a production integration. Mark incomplete behavior clearly in both UI and documentation.

## Review priorities

1. Chess correctness and authoritative online state
2. Security, privacy, abuse prevention, and rating integrity
3. Failure recovery and data consistency
4. Accessibility, touch, keyboard, and responsive behavior
5. Performance and maintainability
6. Visual polish
