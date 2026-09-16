# SMAI Sentinel — redesign preview

Hebrew RTL digital-safety workspace, with a responsive midnight theme, restrained motion, reporting, staff administration, community, private messages, and a server-side Gemini integration.

## Run

Requires Node.js 24 (local development uses `node:sqlite`) and pnpm.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

The local API uses `.local/sentinel.sqlite` and a **local-only simulated owner**. It is never included in the production Worker. Production uses verified Sites identity headers and an explicit `ADMIN_EMAILS` server allowlist. No browser role, local account, password, or client identity is trusted.

## Production

This is a **server-backed application**, not a GitHub Pages/static-only build. The build emits a Cloudflare-compatible Worker at `dist/server/index.js`. Runtime bindings and migrations are packaged by Sites. The private preview has its own database; it does not read or mutate the legacy Firebase project.

Configure server environment secrets outside source control:

- `ADMIN_EMAILS`: explicit, comma-separated owner allowlist. Never inferred from the first visitor.
- `GEMINI_API_KEY`: server secret; required for real AI responses.
- `GEMINI_MODEL`: defaults to `gemini-flash-latest`.

AI calls require sign-in, consent for report context, same-origin requests, and rate limits. No model can grant privileges, close a report, or execute moderation commands. AI-unavailable states are explicit; report saving is independent of AI. Email delivery is currently disabled and disclosed in the interface.

## Verification

`pnpm test` exercises the API with SQLite-backed fixtures: report persistence, ID and role forgery, cross-user access, private rooms, internal notes, CSRF rejection, owner allowlisting, and honest missing-AI configuration. These are automated server checks, not an exhaustive browser, accessibility, penetration, or legal audit.

## Before replacing the original public website

1. Connect and test the Gemini secret against the provider.
2. Approve the move from legacy Firebase identities/data and implement a reviewed migration. Legacy accounts and data have not been imported.
3. Connect an email service if notifications are required.
4. Review child-safety operations, privacy notices, retention/deletion, moderation, and current guide content.
5. Test all public user journeys and accessibility in a browser; run a production security review and load tests. Current collection reads are capped at 10,000 rows and are suitable for the private preview, not high-volume public operation.
6. Deploy to a server-capable host and switch the public domain only after approval.

The original `main` revision remains available in Git history. Do not replace the public GitHub Pages site with this source without changing its deployment pipeline.

## Provider references

- [Gemini GenerateContent](https://ai.google.dev/api/generate-content)
- [Gemini API authentication](https://ai.google.dev/api)

## Official links

- Website: https://smai-support.jo3.org/
- Support/reporting: smai-support@proton.me
- Contact: minipro.7548@gmail.com
- X: https://x.com/smai_sentinel
- Facebook: https://www.facebook.com/profile.php?id=61594140369939
- Reddit: https://www.reddit.com/r/SMAISentinelOfficial/
- Instagram: https://www.instagram.com/smai_creator/
- TikTok: https://www.tiktok.com/@smai_sentinel

SMAI Sentinel refers to this independent Israeli online safety initiative. It is not Microsoft Sentinel, SiMa.ai Sentinel, or a Modalix DevKit monitoring tool.
