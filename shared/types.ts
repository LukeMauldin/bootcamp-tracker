export type UserRole = "player" | "coach";

export type ChallengeDay = "mon" | "tue" | "wed" | "thu" | "fri";

export type ChallengeType = "boolean" | "behavior" | "photo";

export type SubmissionStatus = "pending" | "verified" | "rejected";

export interface Challenge {
  readonly id: string;
  readonly type: ChallengeType;
  readonly title: string;
  readonly description: string;
}

export interface ChallengeCatalog {
  readonly challengeStartDate: string;
  readonly timezone: string;
  readonly basePoints: number;
  readonly bonusPoints: number;
  readonly days: Record<ChallengeDay, readonly Challenge[]>;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly joinCode: string;
  readonly color: string;
  readonly createdAt?: unknown;
}

export interface UserProfile {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly teamId: string;
  readonly role: UserRole;
  readonly createdAt?: unknown;
}

export interface Submission {
  readonly id: string;
  readonly userId: string;
  readonly teamId: string;
  readonly challengeId: string;
  readonly day: ChallengeDay;
  readonly dayDate: string;
  readonly type: ChallengeType;
  readonly value: number | boolean | null;
  readonly photoPath: string | null;
  readonly status: SubmissionStatus;
  readonly basePoints: number;
  readonly bonusPoints: number;
  readonly pointsAwarded: number;
  readonly submittedAt?: unknown;
  readonly verifiedBy: string | null;
  readonly verifiedAt?: unknown;
  readonly adminNote: string | null;
}

export interface LeaderboardRow {
  readonly teamId: string;
  readonly name: string;
  readonly color: string;
  readonly points: number;
  readonly verifiedSubmissions: number;
  readonly adjustments: number;
  readonly rank: number;
}

export interface TeammateStatus {
  readonly uid: string;
  readonly displayName: string;
  readonly completedToday: number;
  readonly totalToday: number;
  readonly streakDays: number;
}
