export const SEASON_HEADER_COLUMNS = [
  "Signup",
  "Player Name",
  "Player Tag",
  "Current Clan",
  "Discord",
  "TH",
  "Combined Heroes",
  "War Hitrate",
  "CWL Hitrate",
  "Last CWL",
  "Notes",
  "Total Attacks",
  "Stars",
  "Avg Stars",
  "Destruction",
  "Avg Destruction",
  "3 Stars",
  "2 Stars",
  "1 Star",
  "0 Stars",
  "Missed",
  "Defense Stars",
  "Defense Avg Stars",
  "Defense Destruction",
  "Defense Avg Destruction"
] as const;

export type SeasonHeaderColumn = (typeof SEASON_HEADER_COLUMNS)[number];
