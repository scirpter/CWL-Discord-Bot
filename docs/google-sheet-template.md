# Google Sheet Template

## Structure

The bot initializes:

- `COVER SHEET`
- `{MMM YYYY CWL}` (for active season)

## Cover Sheet

Rows include:

- Guild
- Configured Clans
- Active Season
- Signup Status
- Sync Status
- Last Sync
- Legend

## Season Sheet

### Roster Blocks (top area)

- Starts near row 3
- One colored section per roster (e.g. Champ 2A, Champ 2B)
- Leader assignment data written from `/cwl roster ...` commands

### Signup Pool + Stats (below)

Header row contains:

- Signup
- Player Name
- Player Tag
- Current Clan
- Discord
- TH
- Combined Heroes
- War Hitrate
- CWL Hitrate
- Last CWL
- Notes
- Total Attacks
- Stars
- Avg Stars
- Destruction
- Avg Destruction
- 3 Stars
- 2 Stars
- 1 Stars
- 0 Stars
- Missed
- Defense Stars
- Defense Avg Stars
- Defense Destruction
- Defense Avg Destruction

## Formatting Rules

- Data validation on signup status column (`YES`/`NO`)
- Conditional format for missed attacks (`Missed > 0`)
- Conditional format for weak defense average stars
- Frozen rows include roster + header region for easier scrolling

## Service Account Access

Share your spreadsheet with the service account email from `GOOGLE_SERVICE_ACCOUNT_JSON`.
Without this, writes will fail.
