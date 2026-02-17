# CWL Bot Command Manual (Client Handoff)

This document covers every slash command currently implemented in the bot and how each one behaves in production.

## 1) Command Overview

Top-level slash commands:

- `/player` (2 subcommands)
- `/cwl` (10 subcommands)
- `/config` (13 subcommands)

Total implemented subcommands: **25**.

## 2) Permission + Visibility Model

Permission requirements:

- `/player ...`: no special Discord permission required (regular members can run these)
- `/cwl ...`: requires `Manage Server` permission
- `/config ...`: requires `Manage Server` permission

Response visibility:

- All slash command responses are ephemeral (only the command user sees them).
- Exception in behavior: `/cwl signup-panel post` also sends a public panel message into the configured signup channel.

Server scope:

- All commands are guild-only (server-only). They are not intended for DMs.

## 3) Input Formats and Validation

Tag format (player/clan):

- Tags are normalized to uppercase and `#` prefixed where applicable.
- Example accepted input: `q9p2qjc` -> stored/used as `#Q9P2QJC`.

Season key format:

- Expected format for optional season parameters: `YYYY-MM` (example: `2026-02`).

Timezone format:

- IANA timezone string (example: `UTC`, `America/New_York`).

Question note length:

- Signup note max: 240 characters.

## 4) Setup Order (Recommended for New Guilds)

Use this exact order for first-time setup:

1. `/config sheet connect spreadsheet_id:<id>`
2. `/config clan add tag:<#TAG> alias:<name>` (repeat per family clan)
3. `/config signup-channel set channel:<#channel>`
4. `/config template init`
5. `/cwl signup-panel post`
6. `/cwl signup open`
7. Members run `/player register tag:<#TAG>`
8. Run `/cwl sync now`

## 5) Command Reference

## `/player`

### `/player register tag:<#TAG>`

Purpose:

- Links the caller's Discord account to a primary Clash player tag.

Inputs:

- `tag` (string, required): player tag.

What it does:

- Verifies the tag via Clash API.
- Stores/updates the guild-local Discord <-> player link.

Success response:

- `Linked <playerName> to <@user> as <#TAG>.`

Common failures:

- Invalid/nonexistent player tag.
- Clash API auth/network failure.

---

### `/player me`

Purpose:

- Shows the caller's currently linked player.

Inputs:

- None.

Success response:

- `Linked player: <#TAG> (<name>)`

Common failures:

- No linked player exists yet.

## `/cwl` (Manage Server required)

### `/cwl signup-panel post`

Purpose:

- Posts the CWL signup panel (embed + "Sign Up" button) in configured signup channel.

Inputs:

- None.

Prerequisites:

- Signup channel must be configured via `/config signup-channel set`.
- Bot must have `View Channel` and `Send Messages` in that channel.
- Channel must be text-based.

Success response:

- `Signup panel posted in <#channel>.`

Common failures:

- Signup channel missing/invalid.
- Missing bot channel permissions.

---

### `/cwl signup open`

Purpose:

- Opens signups for active season.

Success response:

- `Signups opened for <Season Name>.`

---

### `/cwl signup lock`

Purpose:

- Locks signups for active season.

Success response:

- `Signups locked for <Season Name>.`

---

### `/cwl signup unlock`

Purpose:

- Unlocks signups for active season.

Success response:

- `Signups unlocked for <Season Name>.`

---

### `/cwl signup status`

Purpose:

- Displays active season and lock state.

Success response:

- Two-line status message:
  - `Season: <Season Name>`
  - `Signups: Open|Locked`

---

### `/cwl sync now [season] [clan]`

Purpose:

- Runs immediate data sync (Clash + DB + Sheets write).

Inputs:

- `season` (string, optional): season key `YYYY-MM`.
- `clan` (string, optional): clan tag filter.

What it does:

- Refreshes snapshots for signed-up players.
- Pulls current war + league wars for configured clans (or filtered clan).
- Recomputes metrics.
- Writes signup/stat pool rows and roster blocks to Sheets.
- Updates cover sheet status fields.

Success response:

- `Sync complete. Players: <n>, wars: <n>.`

Common failures:

- Requested season not found.
- Sheet not connected or service account access missing.
- Clash API/network errors.

---

### `/cwl roster create name:<name> size:<15|30> clan:<tag>`

Purpose:

- Creates a roster block for current season.

Inputs:

- `name` (string, required): roster display name (example `Champ 2A`).
- `size` (integer choice, required): `15` or `30`.
- `clan` (string, required): target clan tag.

Validation:

- Clan tag must already exist in configured family clans.

Success response:

- `Created roster <name> (15v15|30v30) for <clanTag>.`

---

### `/cwl roster assign roster:<name> player:<@user|#tag>`

Purpose:

- Assigns a player to a roster.

Inputs:

- `roster` (string, required): roster name.
- `player` (string, required): either player tag or Discord @mention.

Behavior details:

- If `player` is mention, bot resolves mention -> linked player tag.
- If mention has no linked player, assignment fails.
- Assignment triggers a follow-up sync for that player.

Success response:

- `Assigned <#TAG> to <Roster Name>.`

Common failures:

- Roster not found.
- Mentioned user not linked.

---

### `/cwl roster unassign roster:<name> player:<#tag>`

Purpose:

- Removes a player from a roster.

Inputs:

- `roster` (string, required)
- `player` (string, required): player tag

Behavior details:

- Removes mapping if present.
- Triggers a follow-up sync.

Success responses:

- Removed case: `Removed <#TAG> from <Roster Name>.`
- Not-found case: `No assignment found for <#TAG> in <Roster Name>.`

---

### `/cwl roster suggest [roster]`

Purpose:

- Shows ranking suggestions based on scoring model.

Inputs:

- `roster` (string, optional): if provided, trims suggestion count to that roster size.

Output format:

- Text code block list, max 50 lines.
- Each line includes: rank, player name/tag, TH, score, war hitrate, cwl hitrate.

Common failures:

- Roster not found (when roster filter used).

---

### `/cwl roster export [roster]`

Purpose:

- Exports roster(s) in copy/paste text block format.

Inputs:

- `roster` (string, optional): export specific roster or all.

Output format:

- Code block with sections like:
  - `# Champ 2A (12/15)`
  - numbered member lines with player tags.

Common failures:

- Roster not found (when filter used).

## `/config` (Manage Server required)

### `/config clan add tag:<#TAG> alias:<name>`

Purpose:

- Adds clan to guild family clan list.

Success response:

- `Added clan <alias> (<#TAG>).`

Notes:

- If same guild/tag already exists, existing row is reused.

---

### `/config clan remove tag:<#TAG>`

Purpose:

- Removes clan from family list.

Success responses:

- Removed case: `Removed clan <#TAG>.`
- Not-found case: `Clan not found.`

---

### `/config sheet connect spreadsheet_id:<id>`

Purpose:

- Connects the guild to target Google spreadsheet.

Success response:

- `Spreadsheet connected: <id>.`

Important:

- Spreadsheet must be shared with the service account email.

---

### `/config signup-channel set channel:<#channel>`

Purpose:

- Sets the channel used by `/cwl signup-panel post`.

Success response:

- `Signup channel set to <#channel>.`

---

### `/config timezone set tz:<IANA>`

Purpose:

- Stores guild timezone preference.

Success response:

- `Timezone set to <tz>.`

Current implementation note:

- Timezone is saved and exposed in settings; season naming/rollover currently still uses UTC month logic.

---

### `/config schedule set hours:<int>`

Purpose:

- Sets scheduler sync interval in hours.

Input rules:

- Any integer accepted at command level.
- Runtime clamps to `1..24`.

Success response:

- `Scheduled sync interval set to <N>h.`

---

### `/config scoring set [th] [heroes] [war] [cwl] [missed_penalty] [competitive_bonus] [availability_bonus]`

Purpose:

- Updates one or more scoring weights used by roster suggestions.

Inputs:

- All fields optional; unspecified values keep existing settings.

Success response:

- Multi-line list with all applied weights and 3-decimal formatting.

---

### `/config questions list`

Purpose:

- Lists active signup question set.

Output format:

- Code block, one line per question:
  - `<index>. <prompt> -> <option1, option2, ...>`

---

### `/config questions edit index:<1-5> prompt:<text> options:<csv>`

Purpose:

- Edits one signup question.

Inputs:

- `index` (int, required): `1..5`
- `prompt` (string, required)
- `options` (string, required): comma-separated list

Validation:

- Options are split on commas, trimmed, empties removed.
- At least one option required.

Success response:

- `Updated question <index>: <prompt> -> <options...>`

---

### `/config questions reset-defaults`

Purpose:

- Resets questions to default set.

Success response:

- `Reset 5 questions to defaults.`

Default questions:

1. Availability this CWL? (`Yes all wars`, `Partial`, `No`)
2. Competitiveness preference? (`Competitive`, `Relaxed`, `Either`)
3. Roster size preference? (`15v15`, `30v30`, `Either`)
4. Hero readiness? (`Ready`, `Almost ready`, `Not ready`)
5. Preferred clan/tier? (`Any` + dynamic clan/roster options at runtime)

---

### `/config template init [season]`

Purpose:

- Creates or refreshes sheet structure and baseline formatting.

Inputs:

- `season` (optional): `YYYY-MM`; if omitted, uses active season.

Success response:

- `Template initialized for <Season Name>.`

---

### `/config template refresh-format [season]`

Purpose:

- Refreshes formatting/layout for season sheet.

Current behavior:

- Uses same backend path as template init.

Success response:

- `Template formatting refreshed for <Season Name>.`

## 6) Signup Interaction Flow (Panel UX)

This is user-facing behavior triggered by `/cwl signup-panel post`.

Flow:

1. User clicks `Sign Up` button on panel.
2. Bot opens ephemeral wizard (question-by-question select menu).
3. After question 5, user can:
   - `Add Note` (modal, optional), or
   - `Submit Without Note`.
4. User can cancel anytime.

Important behavior:

- Draft session expires after 10 minutes of inactivity.
- Submitting again overwrites previous signup for that season/user.
- On successful submit, immediate per-player sync is triggered.

## 7) Eligibility + Data Rules

Signup eligibility:

- User must have linked player (`/player register`).
- Linked player must currently be in one of configured family clans.
- Active season must not be locked.

Data model behavior:

- One signup record per guild + season + Discord user.
- Roster assignment is per guild + season + roster + player tag.
- Metrics are computed from stored snapshots + war events.

## 8) Typical Admin Error Messages

Common messages your client may see:

- `You need the Manage Server permission to run this command.`
- `Signup channel is not configured. Use /config signup-channel set first.`
- `Spreadsheet is not connected yet. Use /config sheet connect first.`
- `Your linked player must be in one of the configured family clans to sign up.`
- `Signups are currently locked. Ask a leader to unlock signups.`
- `Roster not found.`

## 9) Client Handoff Notes

- This document reflects currently implemented behavior in code (not roadmap-only commands).
