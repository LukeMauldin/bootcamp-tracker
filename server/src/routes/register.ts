import { Router } from "express";
import { z } from "zod";

import { COACH_JOIN_CODE, COACH_TEAM_SENTINEL, type UserProfile } from "@bootcamp/shared/types";

import { type AuthedRequest, verifyIdToken } from "../auth.js";
import { asyncHandler, HttpError } from "../http.js";
import { adminAuth, db, FieldValue } from "../lib/firestore.js";
import { normalizeTeam } from "../lib/teams.js";

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

    if (normalizedJoinCode === COACH_JOIN_CODE) {
      const userRecord = await adminAuth.getUser(req.user.uid);
      await adminAuth.setCustomUserClaims(req.user.uid, {
        ...(userRecord.customClaims ?? {}),
        role: "coach"
      });

      const profile: Omit<UserProfile, "uid"> = {
        email: userRecord.email ?? req.user.email,
        displayName: body.displayName,
        teamId: COACH_TEAM_SENTINEL,
        role: "coach",
        createdAt: FieldValue.serverTimestamp()
      };

      await db.collection("users").doc(req.user.uid).set(profile, { merge: false });

      res.status(201).json({
        user: {
          uid: req.user.uid,
          ...profile
        },
        team: null
      });
      return;
    }

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
      team: normalizeTeam(teamDoc.id, teamDoc.data())
    });
  })
);
