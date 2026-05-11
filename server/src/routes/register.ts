import { Router } from "express";
import { z } from "zod";

import type { Team, UserProfile } from "@bootcamp/shared/types";

import { type AuthedRequest, verifyIdToken } from "../auth.js";
import { asyncHandler, HttpError } from "../http.js";
import { adminAuth, db, FieldValue } from "../lib/firestore.js";

const registerBody = z.object({
  displayName: z.string().trim().min(1).max(80),
  joinCode: z.string().trim().min(1).max(40)
});

export const registerRouter = Router();

registerRouter.post(
  "/",
  verifyIdToken,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const body = registerBody.parse(req.body);
    const normalizedJoinCode = body.joinCode.toUpperCase();
    const teamSnapshot = await db.collection("teams").where("joinCode", "==", normalizedJoinCode).limit(1).get();

    if (teamSnapshot.empty) {
      throw new HttpError(400, "Invalid join code");
    }

    const teamDoc = teamSnapshot.docs[0];
    if (!teamDoc) {
      throw new HttpError(400, "Invalid join code");
    }

    const userRecord = await adminAuth.getUser(req.user.uid);
    const role = req.user.role;
    const profile: Omit<UserProfile, "uid"> = {
      email: userRecord.email ?? req.user.email,
      displayName: body.displayName,
      teamId: teamDoc.id,
      role,
      createdAt: FieldValue.serverTimestamp()
    };

    await db.collection("users").doc(req.user.uid).set(profile, { merge: false });

    res.status(201).json({
      user: {
        uid: req.user.uid,
        ...profile
      },
      team: {
        id: teamDoc.id,
        ...(teamDoc.data() as Omit<Team, "id">)
      }
    });
  })
);
