import type { NextFunction, Request, Response } from "express";

import type { UserProfile, UserRole } from "@bootcamp/shared/types";

import { adminAuth, db } from "./lib/firestore.js";

export interface AuthUser {
  readonly uid: string;
  readonly email: string;
  readonly role: UserRole;
}

export type AuthedRequest = Request & {
  user: AuthUser;
};

export type ProfileRequest = AuthedRequest & {
  profile: UserProfile;
};

function extractBearerToken(req: Request): string | null {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length).trim();
}

export async function verifyIdToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    (req as AuthedRequest).user = {
      uid: decoded.uid,
      email: decoded.email ?? "",
      role: decoded.role === "coach" ? "coach" : "player"
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid bearer token" });
  }
}

export async function loadProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authed = req as AuthedRequest;
  const snapshot = await db.collection("users").doc(authed.user.uid).get();
  if (!snapshot.exists) {
    res.status(404).json({ error: "User profile is not registered" });
    return;
  }

  (req as ProfileRequest).profile = {
    uid: snapshot.id,
    ...(snapshot.data() as Omit<UserProfile, "uid">)
  };
  next();
}

export function requireCoach(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthedRequest).user.role !== "coach") {
    res.status(403).json({ error: "Coach role required" });
    return;
  }
  next();
}
