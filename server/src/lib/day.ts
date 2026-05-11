import { DateTime } from "luxon";

import type { ChallengeDay } from "@bootcamp/shared/types";

import { challengeCatalog } from "./catalog.js";

export const challengeDays = ["mon", "tue", "wed", "thu", "fri"] as const satisfies readonly ChallengeDay[];

export interface CurrentChallengeDay {
  readonly day: ChallengeDay | null;
  readonly dayDate: string;
  readonly timezone: string;
}

export function areAllChallengeDaysOpen(): boolean {
  return ["1", "true", "yes"].includes((process.env.CHALLENGE_OPEN_ALL_DAYS ?? "").toLowerCase());
}

export function getChallengeDayDate(day: ChallengeDay): string {
  const zone = challengeCatalog.timezone;
  const start = DateTime.fromISO(challengeCatalog.challengeStartDate, { zone }).startOf("day");
  const offset = challengeDays.indexOf(day);
  return start.plus({ days: offset }).toISODate() ?? challengeCatalog.challengeStartDate;
}

export function getCurrentChallengeDay(now = DateTime.now()): CurrentChallengeDay {
  const zone = challengeCatalog.timezone;
  const today = now.setZone(zone).startOf("day");
  const start = DateTime.fromISO(challengeCatalog.challengeStartDate, { zone }).startOf("day");
  const offset = Math.floor(today.diff(start, "days").days);

  const day = offset >= 0 && offset < challengeDays.length ? (challengeDays[offset] ?? null) : null;

  return {
    day,
    dayDate: today.toISODate() ?? challengeCatalog.challengeStartDate,
    timezone: zone
  };
}
