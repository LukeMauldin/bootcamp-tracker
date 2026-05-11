import { Router } from "express";

import type { Team } from "@bootcamp/shared/types";

import { loadProfile, type ProfileRequest, verifyIdToken } from "../auth.js";
import { asyncHandler } from "../http.js";
import { db } from "../lib/firestore.js";

export const meRouter = Router();

meRouter.get(
  "/",
  verifyIdToken,
  loadProfile,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const teamSnapshot = await db.collection("teams").doc(req.profile.teamId).get();
    res.json({
      user: req.profile,
      team: teamSnapshot.exists
        ? {
            id: teamSnapshot.id,
            ...(teamSnapshot.data() as Omit<Team, "id">)
          }
        : null
    });
  })
);
