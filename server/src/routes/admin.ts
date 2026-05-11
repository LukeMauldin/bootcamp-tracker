import { Router } from "express";
import { z } from "zod";

import type { Submission, SubmissionStatus, Team, UserProfile } from "@bootcamp/shared/types";

import { loadProfile, requireCoach, type ProfileRequest, verifyIdToken } from "../auth.js";
import { asyncHandler, HttpError } from "../http.js";
import { challengeCatalog, getChallenge } from "../lib/catalog.js";
import { db, FieldValue } from "../lib/firestore.js";
import { normalizeTeam } from "../lib/teams.js";

const verifyBody = z.object({
  status: z.enum(["verified", "rejected"]),
  bonusPoints: z.coerce.number().int().min(0).max(challengeCatalog.bonusPoints).optional(),
  adminNote: z.string().max(500).optional()
});

const adjustmentBody = z.object({
  teamId: z.string().min(1).nullable().optional(),
  userId: z.string().min(1).nullable().optional(),
  points: z.coerce.number().int().min(-100).max(100),
  reason: z.string().trim().min(1).max(300)
});

const moveTeamBody = z.object({
  teamId: z.string().min(1)
});

function timestampMillis(value: unknown): number {
  return typeof value === "object" && value !== null && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0;
}

export const adminRouter = Router();

adminRouter.use(verifyIdToken, loadProfile, requireCoach);

adminRouter.get(
  "/submissions",
  asyncHandler<ProfileRequest>(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const day = typeof req.query.day === "string" ? req.query.day : undefined;
    let query: FirebaseFirestore.Query = db.collection("submissions");

    if (status && ["pending", "verified", "rejected"].includes(status)) {
      query = query.where("status", "==", status as SubmissionStatus);
    }
    if (day) {
      query = query.where("day", "==", day);
    }

    const [submissionsSnapshot, usersSnapshot, teamsSnapshot] = await Promise.all([
      query.get(),
      db.collection("users").get(),
      db.collection("teams").get()
    ]);

    const users = new Map(usersSnapshot.docs.map((doc) => [doc.id, { uid: doc.id, ...(doc.data() as Omit<UserProfile, "uid">) }]));
    const teams = new Map(teamsSnapshot.docs.map((doc) => [doc.id, normalizeTeam(doc.id, doc.data())]));
    const submissions = submissionsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Submission, "id">) }))
      .sort((left, right) => {
        const leftMillis = timestampMillis(left.submittedAt);
        const rightMillis = timestampMillis(right.submittedAt);
        return rightMillis - leftMillis;
      })
      .slice(0, 100);

    res.json({
      submissions: submissions.map((submission) => {
        const challenge = getChallenge(submission.day, submission.challengeId);
        return {
          ...submission,
          bonusAvailable: challenge?.bonusAvailable === true,
          bonusPointValue: challengeCatalog.bonusPoints,
          user: users.get(submission.userId) ?? null,
          team: teams.get(submission.teamId) ?? null
        };
      })
    });
  })
);

adminRouter.post(
  "/submissions/:id/verify",
  asyncHandler<ProfileRequest>(async (req, res) => {
    const body = verifyBody.parse(req.body);
    const submissionId = req.params.id;
    if (!submissionId) {
      throw new HttpError(400, "Missing submission id");
    }
    const ref = db.collection("submissions").doc(submissionId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Submission not found");
    }

    const submission = snapshot.data() as Submission;
    const bonusPoints = body.status === "verified" ? (body.bonusPoints ?? 0) : 0;
    const challenge = getChallenge(submission.day, submission.challengeId);
    if (bonusPoints > 0 && challenge?.bonusAvailable !== true) {
      throw new HttpError(400, "Bonus points are not available for this challenge");
    }
    const pointsAwarded = body.status === "verified" ? submission.basePoints + bonusPoints : 0;

    await ref.update({
      status: body.status,
      bonusPoints,
      pointsAwarded,
      verifiedBy: req.profile.uid,
      verifiedAt: FieldValue.serverTimestamp(),
      adminNote: body.adminNote ?? null
    });

    res.json({ ok: true });
  })
);

adminRouter.post(
  "/users/:uid/move-team",
  asyncHandler<ProfileRequest>(async (req, res) => {
    const body = moveTeamBody.parse(req.body);
    const uid = req.params.uid;
    if (!uid) {
      throw new HttpError(400, "Missing user id");
    }
    const [teamSnapshot, userSnapshot, submissionsSnapshot] = await Promise.all([
      db.collection("teams").doc(body.teamId).get(),
      db.collection("users").doc(uid).get(),
      db.collection("submissions").where("userId", "==", uid).get()
    ]);

    if (!teamSnapshot.exists) {
      throw new HttpError(404, "Team not found");
    }
    if (!userSnapshot.exists) {
      throw new HttpError(404, "User not found");
    }

    const batch = db.batch();
    batch.update(userSnapshot.ref, { teamId: body.teamId });
    for (const doc of submissionsSnapshot.docs) {
      batch.update(doc.ref, { teamId: body.teamId });
    }
    await batch.commit();

    res.json({ ok: true });
  })
);

adminRouter.post(
  "/adjustments",
  asyncHandler<ProfileRequest>(async (req, res) => {
    const body = adjustmentBody.parse(req.body);
    const doc = await db.collection("pointAdjustments").add({
      teamId: body.teamId ?? null,
      userId: body.userId ?? null,
      points: body.points,
      reason: body.reason,
      createdBy: req.profile.uid,
      createdAt: FieldValue.serverTimestamp()
    });

    res.status(201).json({ id: doc.id });
  })
);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [usersSnapshot, pendingSnapshot, teamsSnapshot, verifiedSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("submissions").where("status", "==", "pending").get(),
      db.collection("teams").get(),
      db.collection("submissions").where("status", "==", "verified").get()
    ]);

    res.json({
      players: usersSnapshot.size,
      teams: teamsSnapshot.size,
      pending: pendingSnapshot.size,
      verified: verifiedSnapshot.size
    });
  })
);
