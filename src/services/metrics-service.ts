import type { PlayerSnapshot, WarAttackEvent } from "@/domain/models/entities.js";
import type { ScoringWeights } from "@/domain/models/scoring.js";

export type ComputedPlayerStats = {
  playerTag: string;
  playerName: string;
  currentClan: string;
  townHall: number;
  combinedHeroes: number;
  warHitrate: number | null;
  cwlHitrate: number | null;
  lastCwl: string;
  totalAttacks: number;
  stars: number;
  avgStars: number | null;
  destruction: number;
  avgDestruction: number | null;
  threeStars: number;
  twoStars: number;
  oneStars: number;
  zeroStars: number;
  missed: number;
  defenseStars: number;
  defenseAvgStars: number | null;
  defenseDestruction: number;
  defenseAvgDestruction: number | null;
  rosterScore: number;
};

type SignupAnswerMap = Map<number, string>;

function roundTo(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toRatio(stars: number, attacks: number): number | null {
  if (attacks <= 0) {
    return null;
  }

  return roundTo(stars / (attacks * 3), 2);
}

function computeScore(params: {
  townHall: number;
  combinedHeroes: number;
  warHitrate: number | null;
  cwlHitrate: number | null;
  missed: number;
  totalAttacks: number;
  answers: SignupAnswerMap;
  weights: ScoringWeights;
}): number {
  const thScore = Math.min(1, params.townHall / 18);
  const heroScore = Math.min(1, params.combinedHeroes / 475);
  const warScore = params.warHitrate ?? 0.5;
  const cwlScore = params.cwlHitrate ?? 0.5;
  const missedRate = params.totalAttacks > 0 ? params.missed / params.totalAttacks : 0;

  let score =
    thScore * params.weights.thWeight +
    heroScore * params.weights.heroWeight +
    warScore * params.weights.warWeight +
    cwlScore * params.weights.cwlWeight -
    missedRate * params.weights.missedPenalty;

  const availability = params.answers.get(1);
  const competitiveness = params.answers.get(2);

  if (availability === "Yes all wars") {
    score += params.weights.availabilityBonus;
  } else if (availability === "Partial") {
    score += params.weights.availabilityBonus * 0.5;
  }

  if (competitiveness === "Competitive") {
    score += params.weights.competitiveBonus;
  } else if (competitiveness === "Either") {
    score += params.weights.competitiveBonus * 0.5;
  }

  return roundTo(Math.max(0, Math.min(1.5, score)), 4);
}

export function computeStatsForPlayers(params: {
  snapshotsByTag: Map<string, PlayerSnapshot>;
  eventsByTag: Map<string, WarAttackEvent[]>;
  answersByTag: Map<string, SignupAnswerMap>;
  weights: ScoringWeights;
}): Map<string, ComputedPlayerStats> {
  const statsByTag = new Map<string, ComputedPlayerStats>();

  for (const [playerTag, snapshot] of params.snapshotsByTag.entries()) {
    const events = params.eventsByTag.get(playerTag) ?? [];
    const answers = params.answersByTag.get(playerTag) ?? new Map<number, string>();

    const warEvents = events.filter((event) => event.warType === "war");
    const cwlEvents = events.filter((event) => event.warType === "cwl");

    const totalAttacks = events.reduce((sum, event) => sum + event.attacksUsed, 0);
    const stars = events.reduce((sum, event) => sum + event.stars, 0);
    const destruction = events.reduce((sum, event) => sum + event.destruction, 0);
    const threeStars = events.reduce((sum, event) => sum + event.triples, 0);
    const twoStars = events.reduce((sum, event) => sum + event.twos, 0);
    const oneStars = events.reduce((sum, event) => sum + event.ones, 0);
    const zeroStars = events.reduce((sum, event) => sum + event.zeroes, 0);
    const missed = events.reduce((sum, event) => sum + (event.missed ? 1 : 0), 0);
    const defenseStars = events.reduce((sum, event) => sum + event.defenseStars, 0);
    const defenseDestruction = events.reduce((sum, event) => sum + event.defenseDestruction, 0);

    const warAttacks = warEvents.reduce((sum, event) => sum + event.attacksUsed, 0);
    const warStars = warEvents.reduce((sum, event) => sum + event.stars, 0);
    const cwlAttacks = cwlEvents.reduce((sum, event) => sum + event.attacksUsed, 0);
    const cwlStars = cwlEvents.reduce((sum, event) => sum + event.stars, 0);

    const warHitrate = toRatio(warStars, warAttacks);
    const cwlHitrate = toRatio(cwlStars, cwlAttacks);
    const avgStars = totalAttacks > 0 ? roundTo(stars / totalAttacks, 2) : null;
    const avgDestruction = totalAttacks > 0 ? roundTo(destruction / totalAttacks, 2) : null;
    const defenseAvgStars = totalAttacks > 0 ? roundTo(defenseStars / totalAttacks, 2) : null;
    const defenseAvgDestruction = totalAttacks > 0 ? roundTo(defenseDestruction / totalAttacks, 2) : null;

    const rosterScore = computeScore({
      townHall: snapshot.townHall,
      combinedHeroes: snapshot.heroesCombined,
      warHitrate,
      cwlHitrate,
      missed,
      totalAttacks,
      answers,
      weights: params.weights
    });

    const mostRecentCwl = cwlEvents.sort((a, b) => b.warDay.getTime() - a.warDay.getTime())[0];
    const lastCwl = mostRecentCwl
      ? `${mostRecentCwl.warDay.getUTCFullYear()}-${String(mostRecentCwl.warDay.getUTCMonth() + 1).padStart(2, "0")}`
      : "N/A";

    statsByTag.set(playerTag, {
      playerTag,
      playerName: snapshot.playerName,
      currentClan: snapshot.clanTag ?? "Unknown",
      townHall: snapshot.townHall,
      combinedHeroes: snapshot.heroesCombined,
      warHitrate,
      cwlHitrate,
      lastCwl,
      totalAttacks,
      stars,
      avgStars,
      destruction: roundTo(destruction, 2),
      avgDestruction,
      threeStars,
      twoStars,
      oneStars,
      zeroStars,
      missed,
      defenseStars,
      defenseAvgStars,
      defenseDestruction: roundTo(defenseDestruction, 2),
      defenseAvgDestruction,
      rosterScore
    });
  }

  return statsByTag;
}
