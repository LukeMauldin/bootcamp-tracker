import { Check, HelpCircle, RefreshCw, Send, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { Submission, SubmissionStatus, Team, TeamDivision, UserProfile } from "@bootcamp/shared/types";

import { PhotoPreview } from "../components/PhotoPreview";
import { StatusPill } from "../components/StatusPill";
import { apiGet, apiPost } from "../lib/api";

type AdminSubmission = Submission & {
  readonly bonusAvailable: boolean;
  readonly bonusPointValue: number;
  readonly user: UserProfile | null;
  readonly team: Team | null;
};

interface Stats {
  readonly players: number;
  readonly teams: number;
  readonly pending: number;
  readonly verified: number;
}

const teamDivisionLabels: Record<TeamDivision, string> = {
  high_school: "High School",
  jr_high: "Jr High"
};

const teamDivisionOrder: readonly TeamDivision[] = ["high_school", "jr_high"];

function teamsByDivision(teams: readonly Team[]): Array<readonly [TeamDivision, readonly Team[]]> {
  return teamDivisionOrder
    .map((division) => [division, teams.filter((team) => team.division === division)] as const)
    .filter(([, divisionTeams]) => divisionTeams.length > 0);
}

function groupByDayThenPlayer(
  submissions: readonly AdminSubmission[]
): Array<readonly [string, ReadonlyArray<readonly [string, readonly AdminSubmission[]]>]> {
  const byDay = new Map<string, AdminSubmission[]>();
  for (const submission of submissions) {
    const list = byDay.get(submission.dayDate) ?? [];
    list.push(submission);
    byDay.set(submission.dayDate, list);
  }

  return [...byDay.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dayDate, daySubs]) => {
      const byPlayer = new Map<string, AdminSubmission[]>();
      for (const submission of daySubs) {
        const list = byPlayer.get(submission.userId) ?? [];
        list.push(submission);
        byPlayer.set(submission.userId, list);
      }
      const playerEntries = [...byPlayer.entries()].sort(([, a], [, b]) => {
        const left = a[0]?.user?.displayName ?? a[0]?.userId ?? "";
        const right = b[0]?.user?.displayName ?? b[0]?.userId ?? "";
        return left.localeCompare(right);
      });
      return [dayDate, playerEntries] as const;
    });
}

function formatDayDate(dayDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${dayDate}T00:00:00.000Z`));
}

function HelpTooltip({ text }: { readonly text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-slate-100 hover:text-blue-900 focus:bg-slate-100 focus:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
        aria-label={text}
      >
        <HelpCircle size={16} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-10 z-10 hidden w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-700 shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

export function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [submissions, setSubmissions] = useState<readonly AdminSubmission[]>([]);
  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [status, setStatus] = useState<SubmissionStatus | "all">("pending");
  const [adjustmentTeamId, setAdjustmentTeamId] = useState("");
  const [adjustmentPoints, setAdjustmentPoints] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const groupedTeams = teamsByDivision(teams);
  const groupedSubmissions = useMemo(() => groupByDayThenPlayer(submissions), [submissions]);

  async function load(): Promise<void> {
    const query = status === "all" ? "" : `?status=${status}`;
    const [statsPayload, submissionsPayload, teamsPayload] = await Promise.all([
      apiGet<Stats>("/api/admin/stats"),
      apiGet<{ submissions: readonly AdminSubmission[] }>(`/api/admin/submissions${query}`),
      apiGet<{ teams: readonly Team[] }>("/api/teams")
    ]);
    setStats(statsPayload);
    setSubmissions(submissionsPayload.submissions);
    setTeams(teamsPayload.teams);
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function verify(id: string, verified: boolean, bonusPoints = 0): Promise<void> {
    await apiPost(`/api/admin/submissions/${id}/verify`, {
      status: verified ? "verified" : "rejected",
      bonusPoints
    });
    await load();
  }

  async function moveUser(uid: string, teamId: string): Promise<void> {
    await apiPost(`/api/admin/users/${uid}/move-team`, { teamId });
    await load();
  }

  async function createAdjustment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await apiPost("/api/admin/adjustments", {
      teamId: adjustmentTeamId,
      points: Number(adjustmentPoints),
      reason: adjustmentReason
    });
    setAdjustmentPoints("");
    setAdjustmentReason("");
    await load();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">Coach tools</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Admin</h1>
        </div>
        <button className="btn-secondary w-fit" onClick={() => void load()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Players", stats?.players ?? 0],
          ["Teams", stats?.teams ?? 0],
          ["Pending", stats?.pending ?? 0],
          ["Verified", stats?.verified ?? 0]
        ].map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-sm font-semibold text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">Point adjustment</h2>
          <HelpTooltip text="Adds or subtracts points from the selected team's leaderboard total. Use a clear reason because adjustments are shown in team details." />
        </div>
        <form className="grid gap-3 md:grid-cols-[1fr_120px_2fr_auto]" onSubmit={(event) => void createAdjustment(event)}>
          <label>
            <span className="sr-only">Team</span>
            <select
              className="field"
              value={adjustmentTeamId}
              onChange={(event) => setAdjustmentTeamId(event.target.value)}
              title="Team receiving the point adjustment."
              required
            >
              <option value="">Team</option>
              {groupedTeams.map(([division, divisionTeams]) => (
                <optgroup key={division} label={teamDivisionLabels[division]}>
                  {divisionTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Points</span>
            <input
              className="field"
              inputMode="numeric"
              placeholder="5"
              value={adjustmentPoints}
              onChange={(event) => setAdjustmentPoints(event.target.value)}
              title="Enter a whole number. Positive values add points; negative values subtract points."
              required
            />
          </label>
          <label>
            <span className="sr-only">Reason</span>
            <input
              className="field"
              placeholder="Reason"
              value={adjustmentReason}
              onChange={(event) => setAdjustmentReason(event.target.value)}
              title="Short reason shown in leaderboard team details."
              required
            />
          </label>
          <button className="btn-primary" title="Create the point adjustment for the selected team.">
            <Send size={16} />
            Add
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold sm:text-xl">Submissions</h2>
          <div className="flex items-center gap-2">
            <HelpTooltip text="Filter submissions by review state. Coaches usually clear Pending first, then audit Verified or Rejected if needed." />
            <select
              className="field max-w-40"
              value={status}
              onChange={(event) => setStatus(event.target.value as SubmissionStatus | "all")}
              title="Filter submissions by status."
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="space-y-6">
          {groupedSubmissions.length === 0 ? (
            <p className="card p-4 text-sm text-gray-500">No submissions match the selected filter.</p>
          ) : null}
          {groupedSubmissions.map(([dayDate, playerEntries]) => (
            <section key={dayDate} className="space-y-3">
              <header className="flex items-baseline justify-between gap-3 border-b border-gray-200 pb-2">
                <h3 className="text-lg font-bold text-slate-900">{formatDayDate(dayDate)}</h3>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{dayDate}</span>
              </header>
              {playerEntries.map(([userId, playerSubs]) => {
                const firstSub = playerSubs[0];
                if (!firstSub) {
                  return null;
                }
                const displayName = firstSub.user?.displayName ?? firstSub.userId;
                const teamName = firstSub.team?.name ?? firstSub.teamId;
                return (
                  <div key={userId} className="card p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 font-bold text-white">
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{displayName}</p>
                          <p className="text-sm text-gray-500">{teamName}</p>
                        </div>
                      </div>
                      {firstSub.user ? (
                        <select
                          className="field w-full sm:ml-auto sm:w-44"
                          value={firstSub.user.teamId}
                          onChange={(event) => firstSub.user && void moveUser(firstSub.user.uid, event.target.value)}
                          title="Move this player and their existing submissions to another team."
                        >
                          {groupedTeams.map(([division, divisionTeams]) => (
                            <optgroup key={division} label={teamDivisionLabels[division]}>
                              {divisionTeams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  Move: {team.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      ) : null}
                    </div>
                    <div className="space-y-3 border-l-2 border-gray-100 pl-4">
                      {playerSubs.map((submission) => {
                        const basePoints = submission.basePoints;
                        const bonusTotal = submission.basePoints + submission.bonusPointValue;
                        return (
                          <article key={submission.id} className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900">{submission.challengeId}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <StatusPill status={submission.status} />
                                  {submission.value !== null ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                      value {String(submission.value)}
                                    </span>
                                  ) : null}
                                </div>
                                {submission.photoPath ? (
                                  <div className="mt-3 max-w-xs">
                                    <PhotoPreview submissionId={submission.id} />
                                  </div>
                                ) : null}
                              </div>
                              <div className="grid gap-2 md:w-64">
                                <p className="text-xs font-medium leading-relaxed text-gray-500">
                                  {submission.bonusAvailable
                                    ? `Verify ${basePoints} awards base points. Verify ${bonusTotal} adds the coach bonus.`
                                    : `Verify awards ${basePoints} base points.`}
                                </p>
                                <button
                                  className="btn-primary"
                                  onClick={() => void verify(submission.id, true, 0)}
                                  title={`Approve this submission for its base ${basePoints} points.`}
                                >
                                  <Check size={16} />
                                  Verify {basePoints} pts
                                </button>
                                {submission.bonusAvailable ? (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => void verify(submission.id, true, submission.bonusPointValue)}
                                    title={`Approve this submission with a ${submission.bonusPointValue}-point bonus, for ${bonusTotal} total points.`}
                                  >
                                    <Check size={16} />
                                    Verify {bonusTotal} pts
                                  </button>
                                ) : null}
                                <button
                                  className="btn-secondary"
                                  onClick={() => void verify(submission.id, false)}
                                  title="Reject this submission and award 0 points."
                                >
                                  <X size={16} />
                                  Reject
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
