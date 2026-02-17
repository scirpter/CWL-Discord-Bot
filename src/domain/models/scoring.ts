export type ScoringWeights = {
  thWeight: number;
  heroWeight: number;
  warWeight: number;
  cwlWeight: number;
  missedPenalty: number;
  competitiveBonus: number;
  availabilityBonus: number;
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  thWeight: 0.25,
  heroWeight: 0.25,
  warWeight: 0.2,
  cwlWeight: 0.2,
  missedPenalty: 0.1,
  competitiveBonus: 0.05,
  availabilityBonus: 0.05
};
