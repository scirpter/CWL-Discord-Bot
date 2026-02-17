# Setup Guide

## Prerequisites

- Node.js `v24.13.0`
- pnpm
- MySQL database
- Discord bot application with token
- Clash of Clans API token
- Google service account with Sheets API enabled

## 1) Install

```bash
pnpm install
```

## 2) Configure

Create `.env` from `.env.example` and fill all required values.

## 3) Database Migration

```bash
pnpm migrate
```

## 4) Command Deployment

Global deployment:

```bash
pnpm deploy:commands
```

Guild-scoped deployment (faster updates):

```bash
# PowerShell
$env:DEPLOY_GUILD_ID="YOUR_GUILD_ID"
pnpm deploy:commands
```

## 5) Run

```bash
pnpm dev
```

## 6) First Guild Configuration

Use these slash commands:

1. `/config sheet connect spreadsheet_id:<id>`
2. `/config clan add tag:<#TAG> alias:<name>` (repeat for all clans)
3. `/config signup-channel set channel:<#channel>`
4. `/config timezone set tz:UTC` (or your timezone)
5. `/config template init`
6. `/cwl signup-panel post`
7. `/cwl signup open`

## 7) Verification

- Players run `/player register tag:<#TAG>`.
- Players click **Sign Up** panel button and complete the wizard.
- Run `/cwl sync now` and verify spreadsheet rows update.
