import { Router } from "express";

import type { Submission, TeammateChallengeCompletion, TeammateStatus, UserProfile } from "@bootcamp/shared/types";

import { loadProfile, type ProfileRequest, requireCoach, verifyIdToken } from "../auth.js";
import { asyncHandler } from "../http.js";
import { challengeCatalog } from "../lib/catalog.js";
import { getCurrentChallengeDay } from "../lib/day.js";
import { db } from "../lib/firestore.js";
import { compareTeams, normalizeTeam } from "../lib/teams.js";

export const teamsRouter = Router();

function currentStreak(submissions: readonly Submission[], asOf: string): number {
  const verified = new Set(submissions.filter((item) => item.status === "verified").map((item) => item.dayDate));
  const cursor = new Date(`${asOf}T00:00:00.000Z`);
  if (!verified.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let count = 0;
  while (verified.has(cursor.toISOString().slice(0, 10))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

teamsRouter.get(
  "/teams",
  verifyIdToken,
  loadProfile,
  requireCoach,
  asyncHandler(async (_req, res) => {
    const snapshot = await db.collection("teams").get();
    res.json({ teams: snapshot.docs.map((doc) => normalizeTeam(doc.id, doc.data())).sort(compareTeams) });
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

    const dayChallenges = current.day ? challengeCatalog.days[current.day] : [];
    const totalToday = dayChallenges.length;
    const statuses: TeammateStatus[] = teammates.map((teammate) => {
      const submissions = submissionsByUser.get(teammate.uid) ?? [];
      const todaySubmissions = submissions.filter((submission) => submission.dayDate === current.dayDate);
      const completedToday = current.dayDate
        ? new Set(
            todaySubmissions
              .filter((submission) => submission.status !== "rejected")
              .map((submission) => submission.challengeId)
          ).size
        : 0;

      const todayCompletions: TeammateChallengeCompletion[] = dayChallenges.map((challenge) => {
        const submission = todaySubmissions.find((item) => item.challengeId === challenge.id);
        return {
          challengeId: challenge.id,
          title: challenge.title,
          status: submission?.status ?? "missing"
        };
      });

      return {
        uid: teammate.uid,
        displayName: teammate.displayName,
        completedToday,
        totalToday,
        streakDays: currentStreak(submissions, current.dayDate),
        todayCompletions
      };
    });

    const teamSnapshot = await db.collection("teams").doc(req.profile.teamId).get();
    res.json({
      team: teamSnapshot.exists ? normalizeTeam(teamSnapshot.id, teamSnapshot.data()) : null,
      teammates: statuses
    });
  })
);
