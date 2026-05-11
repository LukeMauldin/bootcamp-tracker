import { DateTime } from "luxon";

import type { ChallengeDay } from "@bootcamp/shared/types";

import { challengeCatalog } from "./catalog.js";

const challengeDays = ["mon", "tue", "wed", "thu", "fri"] as const satisfies readonly ChallengeDay[];

export interface CurrentChallengeDay {
  readonly day: ChallengeDay | null;
  readonly dayDate: string;
  readonly timezone: string;
}

export function getCurrentChallengeDay(now = DateTime.now()): CurrentChallengeDay {
  const zone = challengeCatalog.timezone;
  const overrideDate = process.env.CHALLENGE_DATE_OVERRIDE;
  const today = (overrideDate ? DateTime.fromISO(overrideDate, { zone }) : now.setZone(zone)).startOf("day");
  const start = DateTime.fromISO(challengeCatalog.challengeStartDate, { zone }).startOf("day");
  const offset = Math.floor(today.diff(start, "days").days);

  const day = offset >= 0 && offset < challengeDays.length ? (challengeDays[offset] ?? null) : null;

  return {
    day,
    dayDate: today.toISODate() ?? challengeCatalog.challengeStartDate,
    timezone: zone
  };
}
