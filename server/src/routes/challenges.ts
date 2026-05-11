import { Router } from "express";

import { loadProfile, type ProfileRequest, verifyIdToken } from "../auth.js";
import { asyncHandler } from "../http.js";
import { challengeCatalog } from "../lib/catalog.js";
import { areAllChallengeDaysOpen, getCurrentChallengeDay } from "../lib/day.js";
import { db } from "../lib/firestore.js";

export const challengesRouter = Router();

challengesRouter.get(
  "/today",
  verifyIdToken,
  loadProfile,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const current = getCurrentChallengeDay();
    const openAllDays = areAllChallengeDaysOpen();
    if (!current.day) {
      res.json({
        day: null,
        dayDate: current.dayDate,
        timezone: current.timezone,
        openAllDays,
        challengeStartDate: challengeCatalog.challengeStartDate,
        days: challengeCatalog.days,
        challenges: [],
        submissions: {}
      });
      return;
    }

    const submissionsSnapshot = await db
      .collection("submissions")
      .where("userId", "==", req.profile.uid)
      .where("dayDate", "==", current.dayDate)
      .get();

    const submissions = Object.fromEntries(
      submissionsSnapshot.docs.map((doc) => [doc.get("challengeId"), { id: doc.id, ...doc.data() }])
    );

    res.json({
      day: current.day,
      dayDate: current.dayDate,
      timezone: current.timezone,
      openAllDays,
      challengeStartDate: challengeCatalog.challengeStartDate,
      days: challengeCatalog.days,
      challenges: challengeCatalog.days[current.day],
      submissions
    });
  })
);
