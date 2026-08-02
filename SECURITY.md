# Security policy

## Supported version

Security updates are applied to the latest commit on `main` and the current production release.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow for this repository. Do not open a public issue containing exploit details, credentials, personal data, anti-cheat bypasses, or rating-manipulation instructions.

Include:

- affected route, feature, or commit;
- clear reproduction steps;
- expected and observed behavior;
- potential impact;
- a minimal proof of concept when safe;
- any suggested mitigation.

## Sensitive areas

Reports involving authentication headers, room authorization, move/version validation, clock manipulation, duplicate rating application, D1 query boundaries, secret leakage, or Stockfish worker asset loading receive priority.

Never include production credentials in a report. Revoke exposed credentials immediately through the owning platform.
