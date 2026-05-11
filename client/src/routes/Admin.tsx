import { Check, RefreshCw, Send, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { Submission, SubmissionStatus, Team, UserProfile } from "@bootcamp/shared/types";

import { PhotoPreview } from "../components/PhotoPreview";
import { StatusPill } from "../components/StatusPill";
import { apiGet, apiPost } from "../lib/api";

type AdminSubmission = Submission & {
  readonly user: UserProfile | null;
  readonly team: Team | null;
};

interface Stats {
  readonly players: number;
  readonly teams: number;
  readonly pending: number;
  readonly verified: number;
}

export function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [submissions, setSubmissions] = useState<readonly AdminSubmission[]>([]);
  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [status, setStatus] = useState<SubmissionStatus | "all">("pending");
  const [adjustmentTeamId, setAdjustmentTeamId] = useState("");
  const [adjustmentPoints, setAdjustmentPoints] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

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
          <h1 className="text-3xl font-bold">Admin</h1>
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

      <section className="card p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_120px_2fr_auto]" onSubmit={(event) => void createAdjustment(event)}>
          <select className="field" value={adjustmentTeamId} onChange={(event) => setAdjustmentTeamId(event.target.value)} required>
            <option value="">Team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <input className="field" inputMode="numeric" placeholder="-3" value={adjustmentPoints} onChange={(event) => setAdjustmentPoints(event.target.value)} required />
          <input className="field" placeholder="Reason" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} required />
          <button className="btn-primary">
            <Send size={16} />
            Add
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Submissions</h2>
          <select className="field max-w-40" value={status} onChange={(event) => setStatus(event.target.value as SubmissionStatus | "all")}>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="space-y-4">
          {submissions.map((submission) => (
            <article className="card p-4" key={submission.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 font-bold text-white">
                      {(submission.user?.displayName ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{submission.user?.displayName ?? submission.userId}</p>
                      <p className="text-sm text-gray-500">
                        {submission.team?.name ?? submission.teamId} · {submission.challengeId} · {submission.dayDate}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill status={submission.status} />
                    {submission.value !== null ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">value {String(submission.value)}</span> : null}
                  </div>
                  {submission.photoPath ? (
                    <div className="mt-3 max-w-xs">
                      <PhotoPreview submissionId={submission.id} />
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:w-72 md:grid-cols-1">
                  <button className="btn-primary" onClick={() => void verify(submission.id, true, 0)}>
                    <Check size={16} />
                    Verify 5
                  </button>
                  <button className="btn-secondary" onClick={() => void verify(submission.id, true, 2)}>
                    <Check size={16} />
                    Verify 7
                  </button>
                  <button className="btn-secondary" onClick={() => void verify(submission.id, false)}>
                    <X size={16} />
                    Reject
                  </button>
                  <select className="field" value={submission.user?.teamId ?? ""} onChange={(event) => submission.user && void moveUser(submission.user.uid, event.target.value)}>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        Move: {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
