import { google, type sheets_v4 } from "googleapis";

import type { Logger } from "@/infra/logger.js";
import { SEASON_HEADER_COLUMNS } from "@/domain/models/sheet-columns.js";

type SheetsClientOptions = {
  serviceAccountJson: string;
  defaultScopes: string[];
  logger: Logger;
};

export type SeasonSheetRow = Array<string | number>;

export type RosterBlockPayload = {
  rosterName: string;
  clanAlias: string;
  rosterSize: number;
  rows: Array<{
    signupStatus: string;
    playerName: string;
    playerTag: string;
    currentClan: string;
    discordName: string;
    th: number | string;
    heroesCombined: number | string;
    warHitrate: string;
    cwlHitrate: string;
    lastCwl: string;
    note: string;
  }>;
};

const SIGNUP_POOL_HEADER_ROW = 120;

export class SheetsClient {
  private readonly logger: Logger;
  private readonly sheetsApi: ReturnType<typeof google.sheets>;

  public constructor(options: SheetsClientOptions) {
    this.logger = options.logger;

    const credentials = JSON.parse(options.serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: options.defaultScopes
    });

    this.sheetsApi = google.sheets({
      version: "v4",
      auth
    });
  }

  public async initTemplate(
    spreadsheetId: string,
    coverSheetName: string,
    seasonSheetName: string
  ): Promise<void> {
    const spreadsheet = await this.sheetsApi.spreadsheets.get({
      spreadsheetId
    });

    const existingSheets = spreadsheet.data.sheets ?? [];
    const existingTitles = new Set(
      existingSheets.map((sheet) => sheet.properties?.title).filter((value): value is string => Boolean(value))
    );

    const requests: sheets_v4.Schema$Request[] = [];

    if (!existingTitles.has(coverSheetName)) {
      requests.push({
        addSheet: {
          properties: {
            title: coverSheetName
          }
        }
      });
    }

    if (!existingTitles.has(seasonSheetName)) {
      requests.push({
        addSheet: {
          properties: {
            title: seasonSheetName
          }
        }
      });
    }

    if (requests.length > 0) {
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests
        }
      });
    }

    const refreshed = await this.sheetsApi.spreadsheets.get({
      spreadsheetId
    });
    const coverSheetId = this.getSheetId(refreshed.data.sheets ?? [], coverSheetName);
    const seasonSheetId = this.getSheetId(refreshed.data.sheets ?? [], seasonSheetName);

    const formatRequests: sheets_v4.Schema$Request[] = [];

    formatRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: coverSheetId,
          gridProperties: {
            frozenRowCount: 1
          }
        },
        fields: "gridProperties.frozenRowCount"
      }
    });

    formatRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: seasonSheetId,
          gridProperties: {
            frozenRowCount: SIGNUP_POOL_HEADER_ROW
          }
        },
        fields: "gridProperties.frozenRowCount"
      }
    });

    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: seasonSheetId,
          startRowIndex: SIGNUP_POOL_HEADER_ROW - 1,
          endRowIndex: SIGNUP_POOL_HEADER_ROW,
          startColumnIndex: 0,
          endColumnIndex: SEASON_HEADER_COLUMNS.length
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true
            },
            backgroundColor: {
              red: 0.93,
              green: 0.93,
              blue: 0.93
            }
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)"
      }
    });

    formatRequests.push({
      setDataValidation: {
        range: {
          sheetId: seasonSheetId,
          startRowIndex: SIGNUP_POOL_HEADER_ROW,
          endRowIndex: 2200,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: [{ userEnteredValue: "YES" }, { userEnteredValue: "NO" }]
          },
          strict: true,
          showCustomUi: true
        }
      }
    });

    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId: seasonSheetId,
              startRowIndex: SIGNUP_POOL_HEADER_ROW,
              endRowIndex: 2200,
              startColumnIndex: 20,
              endColumnIndex: 21
            }
          ],
          booleanRule: {
            condition: {
              type: "NUMBER_GREATER",
              values: [{ userEnteredValue: "0" }]
            },
            format: {
              backgroundColor: {
                red: 0.9,
                green: 0.2,
                blue: 0.2
              },
              textFormat: {
                bold: true,
                foregroundColor: {
                  red: 1,
                  green: 1,
                  blue: 1
                }
              }
            }
          }
        },
        index: 0
      }
    });

    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId: seasonSheetId,
              startRowIndex: SIGNUP_POOL_HEADER_ROW,
              endRowIndex: 2200,
              startColumnIndex: 22,
              endColumnIndex: 23
            }
          ],
          booleanRule: {
            condition: {
              type: "NUMBER_LESS",
              values: [{ userEnteredValue: "2" }]
            },
            format: {
              backgroundColor: {
                red: 0.95,
                green: 0.75,
                blue: 0.75
              }
            }
          }
        },
        index: 0
      }
    });

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: formatRequests
      }
    });

    await this.sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `${coverSheetName}!A1:B8`,
            values: [
              ["Field", "Value"],
              ["Guild", ""],
              ["Configured Clans", ""],
              ["Active Season", ""],
              ["Signup Status", ""],
              ["Sync Status", ""],
              ["Last Sync", ""],
              ["Legend", "Red cells indicate missed attacks or weak defense values"]
            ]
          },
          {
            range: `${seasonSheetName}!A${SIGNUP_POOL_HEADER_ROW}:Y${SIGNUP_POOL_HEADER_ROW}`,
            values: [SEASON_HEADER_COLUMNS as unknown as string[]]
          }
        ]
      }
    });
  }

  public async updateCoverSheet(params: {
    spreadsheetId: string;
    coverSheetName: string;
    guildName: string;
    clanAliases: string[];
    activeSeasonName: string;
    signupStatus: string;
    syncStatus: string;
    lastSyncIso: string;
  }): Promise<void> {
    await this.sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId: params.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `${params.coverSheetName}!B2:B7`,
            values: [
              [params.guildName],
              [params.clanAliases.join(", ")],
              [params.activeSeasonName],
              [params.signupStatus],
              [params.syncStatus],
              [params.lastSyncIso]
            ]
          }
        ]
      }
    });
  }

  public async writeSeasonRows(
    spreadsheetId: string,
    seasonSheetName: string,
    rows: SeasonSheetRow[]
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const startRow = SIGNUP_POOL_HEADER_ROW + 1;
    const endRow = startRow + rows.length - 1;
    const range = `${seasonSheetName}!A${startRow}:Y${endRow}`;

    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows
      }
    });
  }

  public async writeRosterBlocks(
    spreadsheetId: string,
    seasonSheetName: string,
    blocks: RosterBlockPayload[]
  ): Promise<void> {
    if (blocks.length === 0) {
      return;
    }

    const allRanges: Array<{ range: string; values: string[][] }> = [];
    let cursorRow = 3;

    for (const block of blocks) {
      allRanges.push({
        range: `${seasonSheetName}!A${cursorRow}:K${cursorRow}`,
        values: [
          [
            block.clanAlias,
            "",
            "",
            block.rosterName,
            String(block.rows.length),
            `${block.rosterSize}v${block.rosterSize}`,
            "",
            "",
            "",
            "",
            ""
          ]
        ]
      });

      const memberStart = cursorRow + 1;
      const memberRows = block.rows.map((row) => [
        row.signupStatus,
        row.playerName,
        row.playerTag,
        row.currentClan,
        row.discordName,
        String(row.th),
        String(row.heroesCombined),
        row.warHitrate,
        row.cwlHitrate,
        row.lastCwl,
        row.note
      ]);

      if (memberRows.length > 0) {
        allRanges.push({
          range: `${seasonSheetName}!A${memberStart}:K${memberStart + memberRows.length - 1}`,
          values: memberRows
        });
      }

      cursorRow = memberStart + Math.max(block.rosterSize, memberRows.length) + 2;
    }

    await this.sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: allRanges
      }
    });
  }

  public async clearSeasonRows(spreadsheetId: string, seasonSheetName: string): Promise<void> {
    await this.sheetsApi.spreadsheets.values.clear({
      spreadsheetId,
      range: `${seasonSheetName}!A${SIGNUP_POOL_HEADER_ROW + 1}:Y2200`
    });
  }

  private getSheetId(
    sheets: sheets_v4.Schema$Sheet[],
    title: string
  ): number {
    const found = sheets.find((sheet) => sheet.properties?.title === title);
    const sheetId = found?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) {
      this.logger.error({ title }, "Requested sheet does not exist.");
      throw new Error(`Sheet '${title}' not found.`);
    }

    return sheetId;
  }
}

export const SHEET_LAYOUT = {
  signupHeaderRow: SIGNUP_POOL_HEADER_ROW
} as const;
