# CWL Discord Bot

Production-ready multi-guild Discord bot for Clash of Clans CWL signup, roster planning, and Google Sheets sync.

## Features

- Slash-command only UX (`/player`, `/cwl`, `/config`)
- CWL signup panel with interactive question wizard + optional note modal
- 5 default signup questions, editable per guild
- Per-guild clan family config and eligibility checks
- Clash API sync pipeline (manual + scheduled)
- Google Sheets template generator (cover sheet + monthly CWL tab)
- Roster commands for create/assign/unassign/suggest/export
- Structured logging, retries, queue-based API calls, and strict TypeScript

## Stack

- Node.js `v24.13.0`
- TypeScript (strict)
- `discord.js` `14.25.1`
- MySQL + `drizzle-orm`
- Google Sheets API (`googleapis`)
- `zod`, `neverthrow`, `p-retry`, `p-queue`, `ulid`, `pino`

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment values (see `.env.example`).

3. Run migrations:

```bash
pnpm migrate
```

4. Deploy slash commands:

```bash
pnpm deploy:commands
```

For fast iteration in one guild:

```bash
# PowerShell
$env:DEPLOY_GUILD_ID="YOUR_GUILD_ID"
pnpm deploy:commands
```

5. Start bot:

```bash
pnpm dev
```

## Environment Variables

Required:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DATABASE_URL`
- `COC_API_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

Optional:

- `LOG_LEVEL` (default `info`)
- `GOOGLE_SHEETS_DEFAULT_SCOPES` (default `https://www.googleapis.com/auth/spreadsheets`)
- `APP_TIMEZONE_FALLBACK` (default `UTC`)

## Setup Flow in Discord

1. Link spreadsheet: `/config sheet connect spreadsheet_id:<id>`
2. Add clans: `/config clan add tag:<#TAG> alias:<name>`
3. Set signup channel: `/config signup-channel set channel:<#channel>`
4. Initialize template: `/config template init`
5. Post signup panel: `/cwl signup-panel post`
6. Open signups: `/cwl signup open`
7. Players link accounts: `/player register tag:<#TAG>`
8. Trigger sync anytime: `/cwl sync now`

## Quality Gate

```bash
pnpm lint --fix
pnpm typecheck
pnpm test --coverage
pnpm build
```

## Documentation

- `docs/setup.md`
- `docs/commands.md`
- `docs/google-sheet-template.md`

## Notes

- Share your target Google spreadsheet with the service-account email from `GOOGLE_SERVICE_ACCOUNT_JSON`.
- The bot auto-creates season tabs (`MMM YYYY CWL`) and supports monthly rollover + scheduled sync.
