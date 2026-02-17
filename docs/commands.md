# Slash Commands

## `/player`

- `/player register tag:<#TAG>`
- `/player me`

## `/cwl`

### Signup Panel

- `/cwl signup-panel post`

### Signup Status

- `/cwl signup open`
- `/cwl signup lock`
- `/cwl signup unlock`
- `/cwl signup status`

### Sync

- `/cwl sync now [season] [clan]`

### Rosters

- `/cwl roster create name:<name> size:<15|30> clan:<tag>`
- `/cwl roster assign roster:<name> player:<@user|#tag>`
- `/cwl roster unassign roster:<name> player:<#tag>`
- `/cwl roster suggest [roster]`
- `/cwl roster export [roster]`

## `/config`

### Clan

- `/config clan add tag:<#TAG> alias:<name>`
- `/config clan remove tag:<#TAG>`

### Sheet

- `/config sheet connect spreadsheet_id:<id>`

### Signup Channel

- `/config signup-channel set channel:<#channel>`

### Timezone / Schedule

- `/config timezone set tz:<IANA>`
- `/config schedule set hours:<int>`

### Scoring

- `/config scoring set [th] [heroes] [war] [cwl] [missed_penalty] [competitive_bonus] [availability_bonus]`

### Signup Questions

- `/config questions list`
- `/config questions edit index:<1-5> prompt:<text> options:<csv>`
- `/config questions reset-defaults`

### Template

- `/config template init [season]`
- `/config template refresh-format [season]`
