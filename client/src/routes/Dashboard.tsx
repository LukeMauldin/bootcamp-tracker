import { Check, ChevronRight, Flame, Upload } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { Challenge, ChallengeDay, Submission, TeammateStatus } from "@bootcamp/shared/types";

import { PhotoPreview } from "../components/PhotoPreview";
import { StatusPill } from "../components/StatusPill";
import { apiForm, apiGet } from "../lib/api";
import { useAuth } from "../lib/auth";

interface TodayPayload {
  readonly day: ChallengeDay | null;
  readonly dayDate: string;
  readonly timezone: string;
  readonly challenges: readonly Challenge[];
  readonly submissions: Record<string, Submission>;
}

interface TeammatesPayload {
  readonly teammates: readonly TeammateStatus[];
}

function maxVerifiedStreak(submissions: readonly Submission[]): number {
  const dates = new Set(submissions.filter((submission) => submission.status === "verified").map((submission) => submission.dayDate));
  let best = 0;
  for (const date of dates) {
    const cursor = new Date(`${date}T00:00:00.000Z`);
    let current = 0;
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      current += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    best = Math.max(best, current);
  }
  return best;
}

function ChallengeSubmit({
  challenge,
  submitted,
  onSubmitted
}: {
  readonly challenge: Challenge;
  readonly submitted?: Submission;
  readonly onSubmitted: () => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("challengeId", challenge.id);
      if (challenge.type === "boolean") {
        form.set("value", "true");
      }
      if (challenge.type === "behavior") {
        form.set("value", value);
      }
      if (file) {
        form.set("photo", file);
      }
      await apiForm("/api/submissions", form);
      setValue("");
      setFile(null);
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
      {challenge.type === "behavior" ? (
        <input className="field" inputMode="decimal" placeholder="Behavior score" value={value} onChange={(event) => setValue(event.target.value)} required />
      ) : null}
      {challenge.type !== "boolean" ? (
        <input className="field file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required={challenge.type === "photo"} />
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button className={submitted ? "btn-secondary w-full" : "btn-primary w-full"} disabled={busy}>
        {challenge.type === "boolean" ? <Check size={18} /> : <Upload size={18} />}
        {submitted ? "Resubmit" : "Submit"}
      </button>
    </form>
  );
}

export function Dashboard() {
  const { profile, team } = useAuth();
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [teammates, setTeammates] = useState<readonly TeammateStatus[]>([]);
  const [history, setHistory] = useState<readonly Submission[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    const [todayPayload, teammatePayload, historyPayload] = await Promise.all([
      apiGet<TodayPayload>("/api/challenges/today"),
      apiGet<TeammatesPayload>("/api/teammates"),
      apiGet<{ submissions: readonly Submission[] }>("/api/submissions/mine")
    ]);
    setToday(todayPayload);
    setTeammates(teammatePayload.teammates);
    setHistory(historyPayload.submissions);
  }

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  const streak = useMemo(() => maxVerifiedStreak(history), [history]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading dashboard</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">{team?.name ?? "Team"}</p>
          <h1 className="text-3xl font-bold">Today&apos;s challenges</h1>
          <p className="mt-1 text-sm text-gray-500">{profile?.displayName}</p>
        </div>
        {streak >= 2 ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
            <Flame size={16} />
            🔥 {streak} days
          </div>
        ) : null}
      </header>

      {!today?.day ? (
        <section className="card p-5">
          <h2 className="text-lg font-bold">No active challenge day</h2>
          <p className="mt-1 text-sm text-gray-500">The dashboard will show the current day during the Monday through Friday challenge window.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {today.challenges.map((challenge) => {
            const submitted = today.submissions[challenge.id];
            return (
              <article className="card p-5" key={challenge.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{challenge.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">{challenge.description}</p>
                  </div>
                  {submitted ? <StatusPill status={submitted.status} /> : null}
                </div>
                <ChallengeSubmit challenge={challenge} submitted={submitted} onSubmitted={load} />
              </article>
            );
          })}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Teammates</h2>
          <span className="text-sm font-semibold text-gray-500">{teammates.length} players</span>
        </div>
        <div className="card divide-y divide-gray-200">
          {teammates.map((teammate) => (
            <div className="flex items-center gap-3 p-4" key={teammate.uid}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-white">
                {teammate.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{teammate.displayName}</p>
                <p className="text-sm text-gray-500">
                  {teammate.completedToday}/{teammate.totalToday} submitted today
                </p>
              </div>
              {teammate.streakDays >= 2 ? <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">🔥 {teammate.streakDays}</span> : null}
              <ChevronRight className="text-gray-400" size={18} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">My submissions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {history.slice(0, 6).map((submission) => (
            <article className="card p-4" key={submission.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{submission.challengeId}</p>
                  <p className="text-sm text-gray-500">{submission.dayDate}</p>
                </div>
                <StatusPill status={submission.status} />
              </div>
              {submission.photoPath ? (
                <div className="mt-3">
                  <PhotoPreview submissionId={submission.id} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
