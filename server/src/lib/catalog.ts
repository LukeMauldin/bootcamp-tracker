import { readFileSync } from "node:fs";

import type { Challenge, ChallengeCatalog, ChallengeDay } from "@bootcamp/shared/types";

const catalogUrl = new URL("../data/challenges.json", import.meta.url);

export const challengeCatalog = JSON.parse(readFileSync(catalogUrl, "utf8")) as ChallengeCatalog;

export function getChallenge(day: ChallengeDay, challengeId: string): Challenge | null {
  return challengeCatalog.days[day].find((challenge) => challenge.id === challengeId) ?? null;
}
