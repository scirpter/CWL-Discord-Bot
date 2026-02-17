import PQueue from "p-queue";
import pRetry from "p-retry";

import { AppError } from "@/domain/errors.js";
import type { Logger } from "@/infra/logger.js";
import { encodeClanTagForPath } from "@/utils/clash.js";

const COC_API_BASE = "https://api.clashofclans.com/v1";

type CocApiOptions = {
  token: string;
  logger: Logger;
};

export type CocPlayer = {
  tag: string;
  name: string;
  townHallLevel: number;
  warStars: number;
  attackWins: number;
  defenseWins: number;
  trophies: number;
  donations: number;
  donationsReceived: number;
  clan?: {
    tag: string;
    name: string;
  };
  heroes?: Array<{
    name: string;
    level: number;
  }>;
};

export type CocClan = {
  tag: string;
  name: string;
  members: number;
  memberList: Array<{
    tag: string;
    name: string;
    role: string;
    townHallLevel: number;
  }>;
};

type WarAttack = {
  stars: number;
  destructionPercentage: number;
};

type WarMember = {
  tag: string;
  name: string;
  attacks?: WarAttack[];
  bestOpponentAttack?: {
    stars: number;
    destructionPercentage: number;
  };
};

export type CocWar = {
  state: string;
  clan: {
    tag: string;
    name: string;
    attacks: number;
    members: WarMember[];
  };
  opponent: {
    tag: string;
    name: string;
    attacks: number;
    members: WarMember[];
  };
  startTime?: string;
  endTime?: string;
};

type LeagueGroupResponse = {
  season?: string;
  rounds: Array<{
    warTags: string[];
  }>;
};

export class CocClient {
  private readonly queue: PQueue;
  private readonly token: string;
  private readonly logger: Logger;

  public constructor(options: CocApiOptions) {
    this.token = options.token;
    this.logger = options.logger;
    this.queue = new PQueue({
      concurrency: 4,
      intervalCap: 8,
      interval: 1000
    });
  }

  public async getPlayer(tag: string): Promise<CocPlayer> {
    return this.request<CocPlayer>(`/players/${encodeClanTagForPath(tag)}`);
  }

  public async getClan(tag: string): Promise<CocClan> {
    return this.request<CocClan>(`/clans/${encodeClanTagForPath(tag)}`);
  }

  public async getCurrentWar(tag: string): Promise<CocWar | null> {
    try {
      return await this.request<CocWar>(`/clans/${encodeClanTagForPath(tag)}/currentwar`);
    } catch (error) {
      if (error instanceof AppError && error.code === "COC_NOT_FOUND") {
        return null;
      }

      throw error;
    }
  }

  public async getLeagueWars(tag: string): Promise<CocWar[]> {
    const leagueGroup = await this.request<LeagueGroupResponse>(
      `/clans/${encodeClanTagForPath(tag)}/currentwar/leaguegroup`
    ).catch((error: unknown) => {
      if (error instanceof AppError && error.code === "COC_NOT_FOUND") {
        return null;
      }

      throw error;
    });

    if (!leagueGroup) {
      return [];
    }

    const warTags = leagueGroup.rounds
      .flatMap((round) => round.warTags)
      .filter((warTag) => warTag && warTag !== "#0");

    const wars = await Promise.all(
      warTags.map((warTag) =>
        this.request<CocWar>(`/clanwarleagues/wars/${encodeClanTagForPath(warTag)}`).catch(
          (error: unknown) => {
            this.logger.warn(
              { err: error, warTag },
              "Failed to fetch league war, continuing with remaining wars."
            );
            return null;
          }
        )
      )
    );

    return wars.filter((war): war is CocWar => war !== null);
  }

  private async request<T>(path: string): Promise<T> {
    return this.queue.add(async () =>
      pRetry(
        async () => {
          const response = await fetch(`${COC_API_BASE}${path}`, {
            headers: {
              Authorization: `Bearer ${this.token}`
            }
          });

          if (!response.ok) {
            const body = await response.text();
            const code =
              response.status === 404
                ? "COC_NOT_FOUND"
                : response.status === 403
                  ? "COC_FORBIDDEN"
                  : "COC_HTTP_ERROR";

            throw new AppError(
              code,
              `Clash API request failed (${response.status})`,
              {
                causeData: {
                  status: response.status,
                  body
                }
              }
            );
          }

          return (await response.json()) as T;
        },
        {
          retries: 3
        }
      )
    );
  }
}
