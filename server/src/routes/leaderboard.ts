import { Router } from "express";

import type {
  LeaderboardDetail,
  LeaderboardDetailAdjustment,
  LeaderboardDetailPlayer,
  LeaderboardDetailSubmission,
  LeaderboardGroup,
  LeaderboardRow,
  Submission,
  Team,
  UserProfile
} from "@bootcamp/shared/types";

import { loadProfile, type ProfileRequest, requireCoach, verifyIdToken } from "../auth.js";
import { asyncHandler, HttpError } from "../http.js";
import { challengeCatalog } from "../lib/catalog.js";
import { db } from "../lib/firestore.js";
import { compareTeams, normalizeTeam, TEAM_DIVISION_LABELS, TEAM_DIVISION_ORDER } from "../lib/teams.js";

export const leaderboardRouter = Router();

interface PointAdjustment {
  readonly teamId?: string | null;
  readonly userId?: string | null;
  readonly points?: number;
  readonly reason?: string;
}

const challengeTitles = new Map(
  Object.values(challengeCatalog.days)
    .flatMap((challenges) => challenges)
    .map((challenge) => [challenge.id, challenge.title] as const)
);

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

    const teams = teamsSnapshot.docs.map((doc) => normalizeTeam(doc.id, doc.data())).sort(compareTeams);
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
          division: team.division,
          points: submissionPoints + adjustments,
          verifiedSubmissions: verifiedByTeam.get(team.id) ?? 0,
          adjustments,
          rank: 0
        };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    const groups: LeaderboardGroup[] = TEAM_DIVISION_ORDER.map((division) => ({
      division,
      label: TEAM_DIVISION_LABELS[division],
      rows: rows.filter((row) => row.division === division).map((row, index) => ({ ...row, rank: index + 1 }))
    })).filter((group) => group.rows.length > 0);

    res.json({ leaderboard: groups });
  })
);

leaderboardRouter.get(
  "/:teamId",
  verifyIdToken,
  loadProfile,
  requireCoach,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const teamId = req.params.teamId;
    if (!teamId) {
      throw new HttpError(400, "Missing team id");
    }

    const [teamSnapshot, usersSnapshot, submissionsSnapshot, adjustmentsSnapshot] = await Promise.all([
      db.collection("teams").doc(teamId).get(),
      db.collection("users").where("teamId", "==", teamId).get(),
      db.collection("submissions").where("teamId", "==", teamId).get(),
      db.collection("pointAdjustments").get()
    ]);

    if (!teamSnapshot.exists) {
      throw new HttpError(404, "Team not found");
    }

    const team: Team = normalizeTeam(teamSnapshot.id, teamSnapshot.data());
    const users = usersSnapshot.docs.map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<UserProfile, "uid">) }));
    const usersById = new Map(users.map((user) => [user.uid, user]));
    const submissions = submissionsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Submission, "id">) }));

    const adjustments: LeaderboardDetailAdjustment[] = adjustmentsSnapshot.docs.flatMap((doc) => {
      const adjustment = doc.data() as PointAdjustment;
      if (typeof adjustment.points !== "number") {
        return [];
      }

      const belongsToTeam = adjustment.teamId === teamId || (!adjustment.teamId && !!adjustment.userId && usersById.has(adjustment.userId));
      if (!belongsToTeam) {
        return [];
      }

      const user = adjustment.userId ? usersById.get(adjustment.userId) ?? null : null;
      return [
        {
          id: doc.id,
          teamId: adjustment.teamId ?? null,
          userId: adjustment.userId ?? null,
          playerName: user?.displayName ?? null,
          points: adjustment.points,
          reason: adjustment.reason ?? ""
        }
      ];
    });

    const submissionsByUser = new Map<string, Submission[]>();
    for (const submission of submissions) {
      const existing = submissionsByUser.get(submission.userId) ?? [];
      existing.push(submission);
      submissionsByUser.set(submission.userId, existing);
    }

    const adjustmentsByUser = new Map<string, number>();
    for (const adjustment of adjustments) {
      if (!adjustment.userId) {
        continue;
      }
      adjustmentsByUser.set(adjustment.userId, (adjustmentsByUser.get(adjustment.userId) ?? 0) + adjustment.points);
    }

    const players: LeaderboardDetailPlayer[] = users
      .map((user) => {
        const userSubmissions = submissionsByUser.get(user.uid) ?? [];
        const verifiedSubmissions = userSubmissions.filter((submission) => submission.status === "verified");
        const pendingSubmissions = userSubmissions.filter((submission) => submission.status === "pending").length;
        const rejectedSubmissions = userSubmissions.filter((submission) => submission.status === "rejected").length;
        const submissionPoints = verifiedSubmissions.reduce((total, submission) => total + submission.pointsAwarded, 0);
        const userAdjustments = adjustmentsByUser.get(user.uid) ?? 0;

        return {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          verifiedSubmissions: verifiedSubmissions.length,
          pendingSubmissions,
          rejectedSubmissions,
          submissionPoints,
          adjustments: userAdjustments,
          totalPoints: submissionPoints + userAdjustments
        };
      })
      .sort((left, right) => right.totalPoints - left.totalPoints || left.displayName.localeCompare(right.displayName));

    const detailSubmissions: LeaderboardDetailSubmission[] = submissions
      .map((submission) => ({
        id: submission.id,
        userId: submission.userId,
        playerName: usersById.get(submission.userId)?.displayName ?? submission.userId,
        challengeId: submission.challengeId,
        challengeTitle: challengeTitles.get(submission.challengeId) ?? submission.challengeId,
        day: submission.day,
        dayDate: submission.dayDate,
        status: submission.status,
        value: submission.value,
        basePoints: submission.basePoints,
        bonusPoints: submission.bonusPoints,
        pointsAwarded: submission.pointsAwarded
      }))
      .sort((left, right) => right.dayDate.localeCompare(left.dayDate) || left.playerName.localeCompare(right.playerName) || left.challengeTitle.localeCompare(right.challengeTitle));

    const payload: LeaderboardDetail = {
      team,
      players,
      submissions: detailSubmissions,
      adjustments: adjustments.sort((left, right) => Math.abs(right.points) - Math.abs(left.points) || left.reason.localeCompare(right.reason))
    };

    res.json({ detail: payload });
  })
);
