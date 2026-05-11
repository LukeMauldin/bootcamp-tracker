import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import type { Submission } from "@bootcamp/shared/types";

import { loadProfile, type ProfileRequest, verifyIdToken } from "../auth.js";
import { asyncHandler, HttpError } from "../http.js";
import { challengeCatalog, getChallenge } from "../lib/catalog.js";
import { getCurrentChallengeDay } from "../lib/day.js";
import { db, FieldValue } from "../lib/firestore.js";
import { createSignedReadUrl, uploadSubmissionPhoto } from "../lib/gcs.js";
import {
  detectSupportedPhotoMimeType,
  isSupportedPhotoMimeType,
  MAX_PHOTO_UPLOAD_BYTES,
  PHOTO_UPLOAD_TYPE_ERROR
} from "../lib/photoValidation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_UPLOAD_BYTES,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (isSupportedPhotoMimeType(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new HttpError(400, PHOTO_UPLOAD_TYPE_ERROR));
  }
});

const submissionBody = z.object({
  challengeId: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
});

export const submissionsRouter = Router();

submissionsRouter.post(
  "/",
  verifyIdToken,
  loadProfile,
  upload.single("photo"),
  asyncHandler<ProfileRequest>(async (req, res) => {
    const body = submissionBody.parse(req.body);
    const current = getCurrentChallengeDay();
    if (!current.day) {
      throw new HttpError(400, "No active challenge day");
    }

    const challenge = getChallenge(current.day, body.challengeId);
    if (!challenge) {
      throw new HttpError(400, "Challenge is not active today");
    }

    const submissionId = `${req.profile.uid}_${current.dayDate}_${challenge.id}`;
    const submissionRef = db.collection("submissions").doc(submissionId);
    const existing = await submissionRef.get();
    if (existing.exists && (existing.data() as Submission).status === "verified") {
      throw new HttpError(409, "This challenge has already been verified and cannot be resubmitted.");
    }

    let value: number | boolean | null = null;
    if (challenge.type === "boolean") {
      value = body.value === undefined ? true : body.value === true || body.value === "true";
    } else if (challenge.type === "behavior") {
      const numericValue = Number(body.value);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        throw new HttpError(400, "Behavior score must be a non-negative number");
      }
      value = numericValue;
    }

    if (challenge.type === "photo" && !req.file) {
      throw new HttpError(400, "Photo is required for this challenge");
    }

    if (req.file && !detectSupportedPhotoMimeType(req.file.buffer)) {
      throw new HttpError(400, PHOTO_UPLOAD_TYPE_ERROR);
    }

    const photoPath = req.file
      ? await uploadSubmissionPhoto({
          uid: req.profile.uid,
          challengeId: challenge.id,
          file: req.file
        })
      : null;

    const submission: Omit<Submission, "id"> = {
      userId: req.profile.uid,
      teamId: req.profile.teamId,
      challengeId: challenge.id,
      day: current.day,
      dayDate: current.dayDate,
      type: challenge.type,
      value,
      photoPath,
      status: "pending",
      basePoints: challengeCatalog.basePoints,
      bonusPoints: 0,
      pointsAwarded: 0,
      submittedAt: FieldValue.serverTimestamp(),
      verifiedBy: null,
      verifiedAt: null,
      adminNote: null
    };

    await submissionRef.set(submission, { merge: false });
    res.status(201).json({ submission: { id: submissionId, ...submission } });
  })
);

submissionsRouter.get(
  "/mine",
  verifyIdToken,
  loadProfile,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const snapshot = await db
      .collection("submissions")
      .where("userId", "==", req.profile.uid)
      .orderBy("dayDate", "desc")
      .get();
    res.json({ submissions: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  })
);

submissionsRouter.get(
  "/photos/:submissionId",
  verifyIdToken,
  loadProfile,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const submissionId = req.params.submissionId;
    if (!submissionId) {
      throw new HttpError(400, "Missing submission id");
    }
    const snapshot = await db.collection("submissions").doc(submissionId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "Submission not found");
    }

    const submission = snapshot.data() as Submission;
    if (submission.userId !== req.profile.uid && req.user.role !== "coach") {
      throw new HttpError(403, "Photo access denied");
    }
    if (!submission.photoPath) {
      throw new HttpError(404, "Submission has no photo");
    }

    const url = await createSignedReadUrl(submission.photoPath);
    res.setHeader("Cache-Control", "private, max-age=240");
    res.json({ url });
  })
);
