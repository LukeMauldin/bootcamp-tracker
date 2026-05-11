import { Router } from "express";

import type { LeaderboardRow, Submission, Team, UserProfile } from "@bootcamp/shared/types";

import { loadProfile, verifyIdToken } from "../auth.js";
import { asyncHandler } from "../http.js";
import { db } from "../lib/firestore.js";

export const leaderboardRouter = Router();

leaderboardRouter.get(
  "/",
  verifyIdToken,
  loadProfile,
  asyncHandler(async (_req, res) => {
    const [teamsSnapshot, submissionsSnapshot, adjustmentsSnapshot, usersSnapshot] = await Promise.all([
      db.collection("teams").get(),
      db.collection("submissions").where("status", "==", "verified").get(),
      db.collection("pointAdjustments").get(),
      db.collection("users").get()
    ]);

    const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Team, "id">) }));
    const userTeam = new Map(usersSnapshot.docs.map((doc) => [doc.id, (doc.data() as UserProfile).teamId]));
    const pointsByTeam = new Map<string, number>();
    const verifiedByTeam = new Map<string, number>();
    const adjustmentsByTeam = new Map<string, number>();

    for (const doc of submissionsSnapshot.docs) {
      const submission = doc.data() as Submission;
      pointsByTeam.set(submission.teamId, (pointsByTeam.get(submission.teamId) ?? 0) + submission.pointsAwarded);
      verifiedByTeam.set(submission.teamId, (verifiedByTeam.get(submission.teamId) ?? 0) + 1);
    }

    for (const doc of adjustmentsSnapshot.docs) {
      const adjustment = doc.data() as { teamId?: string | null; userId?: string | null; points?: number };
      if (typeof adjustment.points !== "number") {
        continue;
      }
      const teamId = adjustment.teamId ?? (adjustment.userId ? userTeam.get(adjustment.userId) ?? null : null);
      if (!teamId) {
        continue;
      }
      adjustmentsByTeam.set(teamId, (adjustmentsByTeam.get(teamId) ?? 0) + adjustment.points);
    }

    const rows: LeaderboardRow[] = teams
      .map((team) => {
        const submissionPoints = pointsByTeam.get(team.id) ?? 0;
        const adjustments = adjustmentsByTeam.get(team.id) ?? 0;
        return {
          teamId: team.id,
          name: team.name,
          color: team.color,
          points: submissionPoints + adjustments,
          verifiedSubmissions: verifiedByTeam.get(team.id) ?? 0,
          adjustments,
          rank: 0
        };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((row, index) => ({ ...row, rank: index + 1 }));

    res.json({ leaderboard: rows });
  })
);
