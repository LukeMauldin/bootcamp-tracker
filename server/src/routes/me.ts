import { Router } from "express";

import { loadProfile, type ProfileRequest, verifyIdToken } from "../auth.js";
import { asyncHandler } from "../http.js";
import { db } from "../lib/firestore.js";
import { normalizeTeam } from "../lib/teams.js";

export const meRouter = Router();

meRouter.get(
  "/",
  verifyIdToken,
  loadProfile,
  asyncHandler<ProfileRequest>(async (req, res) => {
    const teamSnapshot = await db.collection("teams").doc(req.profile.teamId).get();
    res.json({
      user: req.profile,
      team: teamSnapshot.exists ? normalizeTeam(teamSnapshot.id, teamSnapshot.data()) : null
    });
  })
);
