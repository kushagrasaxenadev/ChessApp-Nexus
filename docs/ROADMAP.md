# NEXUS product roadmap

This roadmap separates shipped capability from future intent. A feature moves to “shipped” only when its rules, persistence, error handling, accessibility, tests, and operational ownership are complete.

## Release 1.0 — branded competitive foundation

Status: **shipped**

- Accurate standard-chess interaction with complete draw and promotion handling
- Seven ranked bot personalities across five difficulty bands
- Stockfish 18 browser worker for stronger bots and configurable analysis
- Eight time controls, increments, clocks, resign, reset, board flip, PGN, and FEN
- Server-validated multiplayer rooms with persistent moves and authoritative state
- Authenticated profiles, rating pools, game history, and leaderboard endpoints
- Five interface themes, six boards, four piece treatments, touch feedback, and responsive layouts
- Versioned brand system, product metadata, CI, repository governance, and deployment workflow

## Release 1.1 — competitive multiplayer

Focus: make live games resilient under real concurrent use.

- Durable Object rooms with hibernating WebSockets
- Quick pairing by rating pool and time control
- Draw offer, abort, resign, rematch, reconnect, and abandonment policies
- Spectator mode and game-presence events
- Clock-drift, reconnect, duplicate-event, and stale-version test suites
- Moderation primitives for names, chat, blocking, and reports

**Done when:** two clients can complete rated games through network interruptions without clock divergence, duplicated rating updates, or illegal state.

## Release 1.2 — review and improvement

Focus: turn completed games into an understandable learning loop.

- Full-game Stockfish review queue
- Move classifications, accuracy, tactical motifs, and turning points
- Opening explorer and personal opening statistics
- Shareable game-review cards and annotated PGN export
- Puzzles generated from eligible mistakes with spaced repetition
- Production AI coach grounded only in engine lines and rule facts

**Done when:** a completed game produces reproducible engine evidence, useful explanations, and an exportable report without allowing model prose to override chess truth.

## Release 1.3 — community and events

- Friends, challenges, activity, notifications, and privacy controls
- Clubs, arenas, Swiss events, team matches, and standings
- Lessons, study collections, puzzle streaks, and achievement systems
- Creator and moderator tools with audit history

**Done when:** events can be created, played, moderated, concluded, and recovered without manual database intervention.

## Release 2.0 — scale and native reach

- Dedicated engine-analysis service with queues, quotas, and isolation
- Anti-cheat review pipeline with human moderation and appeal workflow
- Observability dashboards, SLOs, load tests, and incident playbooks
- Offline-aware PWA, push notifications, install polish, and mobile packaging
- Internationalization, right-to-left support, screen-reader audit, and reduced-motion modes
- Data retention, export, deletion, and regional compliance controls

## Engineering guardrails

1. The server remains authoritative for online game state.
2. Ratings are idempotent and updated exactly once.
3. Engine and AI workloads never delay live move acceptance.
4. New variants get isolated rule adapters rather than conditions scattered through standard chess.
5. Every milestone includes accessibility, abuse prevention, instrumentation, tests, and rollback planning.
