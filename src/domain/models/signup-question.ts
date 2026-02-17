export type SignupQuestion = {
  index: number;
  prompt: string;
  options: string[];
};

export const DEFAULT_SIGNUP_QUESTIONS: SignupQuestion[] = [
  {
    index: 1,
    prompt: "Availability this CWL?",
    options: ["Yes all wars", "Partial", "No"]
  },
  {
    index: 2,
    prompt: "Competitiveness preference?",
    options: ["Competitive", "Relaxed", "Either"]
  },
  {
    index: 3,
    prompt: "Roster size preference?",
    options: ["15v15", "30v30", "Either"]
  },
  {
    index: 4,
    prompt: "Hero readiness?",
    options: ["Ready", "Almost ready", "Not ready"]
  },
  {
    index: 5,
    prompt: "Preferred clan/tier?",
    options: ["Any"]
  }
];

export const NOTE_MAX_LENGTH = 240;
