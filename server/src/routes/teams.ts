import { Router } from "express";

import type { Submission, Team, TeammateStatus, UserProfile } from "@bootcamp/shared/types";

import { loadProfile, type ProfileRequest, requireCoach, verifyIdToken } from "../auth.js";
import { asyncHandler } from "../http.js";
import { challengeCatalog } from "../lib/catalog.js";
import { getCurrentChallengeDay } from "../lib/day.js";
import { db } from "../lib/firestore.js";

export const teamsRouter = Router();

function streakDays(submissions: readonly Submission[]): number {
  const verifiedDates = new Set(submissions.filter((item) => item.status === "verified").map((item) => item.dayDate));
  let best = 0;
  for (const date of verifiedDates) {
    let current = 0;
    const cursor = new Date(`${date}T00:00:00.000Z`);
    while (verifiedDates.has(cursor.toISOString().slice(0, 10))) {
      current += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    best = Math.max(best, current);
  }
  return best;
}

teamsRouter.get(
  "/teams",
  verifyIdToken,
  loadProfile,
  requireCoach,
  asyncHandler(async (_req, res) => {
    const snapshot = await db.collection("teams").orderBy("name", "asc").get();
    res.json({ teams: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  })
);

teamsRouter.get(
  "/teammates",
  verifyIdToken,
  loadProfile,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const current = getCurrentChallengeDay();
    const usersSnapshot = await db.collection("users").where("teamId", "==", req.profile.teamId).get();
    const teammates = usersSnapshot.docs.map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<UserProfile, "uid">) }));
    const teammateIds = teammates.map((teammate) => teammate.uid);
    const submissionsByUser = new Map<string, Submission[]>();

    if (teammateIds.length > 0) {
      const submissionsSnapshot = await db.collection("submissions").where("teamId", "==", req.profile.teamId).get();
      for (const doc of submissionsSnapshot.docs) {
        const submission = { id: doc.id, ...(doc.data() as Omit<Submission, "id">) };
        const userSubmissions = submissionsByUser.get(submission.userId) ?? [];
        userSubmissions.push(submission);
        submissionsByUser.set(submission.userId, userSubmissions);
      }
    }

    const totalToday = current.day ? challengeCatalog.days[current.day].length : 0;
    const statuses: TeammateStatus[] = teammates.map((teammate) => {
      const submissions = submissionsByUser.get(teammate.uid) ?? [];
      const completedToday = current.dayDate
        ? new Set(
            submissions
              .filter((submission) => submission.dayDate === current.dayDate && submission.status !== "rejected")
              .map((submission) => submission.challengeId)
          ).size
        : 0;

      return {
        uid: teammate.uid,
        displayName: teammate.displayName,
        completedToday,
        totalToday,
        streakDays: streakDays(submissions)
      };
    });

    const teamSnapshot = await db.collection("teams").doc(req.profile.teamId).get();
    res.json({
      team: teamSnapshot.exists ? ({ id: teamSnapshot.id, ...teamSnapshot.data() } as Team) : null,
      teammates: statuses
    });
  })
);
