export const COACH_JOIN_CODE = "COACH-ADMIN-1";
export const COACH_TEAM_SENTINEL = "coach-admin";

export type UserRole = "player" | "coach";

export type ChallengeDay = "mon" | "tue" | "wed" | "thu" | "fri";

export type ChallengeType = "boolean" | "behavior" | "photo";

export type SubmissionStatus = "pending" | "verified" | "rejected";

export type TeamDivision = "high_school" | "jr_high";

export interface Challenge {
  readonly id: string;
  readonly type: ChallengeType;
  readonly title: string;
  readonly description: string;
  readonly checklist?: readonly string[];
  readonly uploadInstructions?: string;
  readonly bonusDescription?: string;
  readonly bonusAvailable?: boolean;
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
  readonly division: TeamDivision;
  readonly sortOrder: number;
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
  readonly division: TeamDivision;
  readonly points: number;
  readonly verifiedSubmissions: number;
  readonly adjustments: number;
  readonly rank: number;
}

export interface LeaderboardGroup {
  readonly division: TeamDivision;
  readonly label: string;
  readonly rows: readonly LeaderboardRow[];
}

export interface LeaderboardDetailPlayer {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly verifiedSubmissions: number;
  readonly pendingSubmissions: number;
  readonly rejectedSubmissions: number;
  readonly submissionPoints: number;
  readonly adjustments: number;
  readonly totalPoints: number;
}

export interface LeaderboardDetailSubmission {
  readonly id: string;
  readonly userId: string;
  readonly playerName: string;
  readonly challengeId: string;
  readonly challengeTitle: string;
  readonly day: ChallengeDay;
  readonly dayDate: string;
  readonly status: SubmissionStatus;
  readonly value: number | boolean | null;
  readonly basePoints: number;
  readonly bonusPoints: number;
  readonly pointsAwarded: number;
}

export interface LeaderboardDetailAdjustment {
  readonly id: string;
  readonly teamId: string | null;
  readonly userId: string | null;
  readonly playerName: string | null;
  readonly points: number;
  readonly reason: string;
}

export interface LeaderboardDetail {
  readonly team: Team;
  readonly players: readonly LeaderboardDetailPlayer[];
  readonly submissions: readonly LeaderboardDetailSubmission[];
  readonly adjustments: readonly LeaderboardDetailAdjustment[];
}

export interface TeammateChallengeCompletion {
  readonly challengeId: string;
  readonly title: string;
  readonly status: SubmissionStatus | "missing";
}

export interface TeammateStatus {
  readonly uid: string;
  readonly displayName: string;
  readonly completedToday: number;
  readonly totalToday: number;
  readonly streakDays: number;
  readonly todayCompletions: readonly TeammateChallengeCompletion[];
}
