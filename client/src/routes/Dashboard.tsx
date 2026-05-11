import { Check, ChevronRight, Flame, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import type { Challenge, ChallengeDay, Submission, TeammateStatus } from "@bootcamp/shared/types";

import { PhotoPreview } from "../components/PhotoPreview";
import { StatusPill } from "../components/StatusPill";
import { apiForm, apiGet } from "../lib/api";
import { useAuth } from "../lib/auth";

const MAX_PHOTO_UPLOAD_BYTES = 8 * 1024 * 1024;
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif";
const challengeDayOrder = ["mon", "tue", "wed", "thu", "fri"] as const satisfies readonly ChallengeDay[];

const challengeDayLabels: Record<ChallengeDay, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday"
};

interface TodayPayload {
  readonly day: ChallengeDay | null;
  readonly dayDate: string;
  readonly timezone: string;
  readonly openAllDays: boolean;
  readonly challengeStartDate: string;
  readonly days: Record<ChallengeDay, readonly Challenge[]>;
  readonly challenges: readonly Challenge[];
  readonly submissions: Record<string, Submission>;
}

interface TeammatesPayload {
  readonly teammates: readonly TeammateStatus[];
}

function currentStreak(submissions: readonly Submission[], asOf: string): number {
  const verified = new Set(submissions.filter((submission) => submission.status === "verified").map((submission) => submission.dayDate));
  const cursor = new Date(`${asOf}T00:00:00.000Z`);
  if (!verified.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let count = 0;
  while (verified.has(cursor.toISOString().slice(0, 10))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

function challengeDate(startDate: string, dayIndex: number): string {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

function formatChallengeDate(dayDate: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${dayDate}T00:00:00.000Z`));
}

function submissionKey(day: ChallengeDay, challengeId: string): string {
  return `${day}:${challengeId}`;
}

function ChallengeDescription({ challenge }: { readonly challenge: Challenge }) {
  if (!challenge.checklist?.length && !challenge.uploadInstructions && !challenge.bonusDescription) {
    return <p className="mt-1 text-sm text-gray-500">{challenge.description}</p>;
  }

  return (
    <div className="mt-1 space-y-2 text-sm leading-6 text-gray-600">
      <p>{challenge.description}</p>
      {challenge.checklist?.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {challenge.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {challenge.uploadInstructions ? <p>{challenge.uploadInstructions}</p> : null}
      {challenge.bonusDescription ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <span className="font-bold">Bonus Points:</span> {challenge.bonusDescription}
        </p>
      ) : null}
    </div>
  );
}

function ChallengeSubmit({
  day,
  challenge,
  submitted,
  onSubmitted
}: {
  readonly day: ChallengeDay;
  readonly challenge: Challenge;
  readonly submitted?: Submission;
  readonly onSubmitted: () => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const selectedFile = event.target.files?.[0] ?? null;
    if (selectedFile && selectedFile.size > MAX_PHOTO_UPLOAD_BYTES) {
      setFile(null);
      setError("Photo must be 8 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("day", day);
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
        <input className="field file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" type="file" accept={PHOTO_ACCEPT} onChange={handleFileChange} required={challenge.type === "photo" || challenge.type === "behavior"} />
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

  const streak = useMemo(() => (today ? currentStreak(history, today.dayDate) : 0), [history, today?.dayDate]);
  const submissionsByChallenge = useMemo(
    () => new Map(history.map((submission) => [submissionKey(submission.day, submission.challengeId), submission] as const)),
    [history]
  );

  if (loading) {
    return <p className="text-sm text-gray-500">Loading dashboard</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">{team?.name ?? "Team"}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Weekly challenges</h1>
          <p className="mt-1 text-sm text-gray-500">{profile?.displayName}</p>
        </div>
        {streak >= 2 ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
            <Flame size={16} />
            🔥 {streak} days
          </div>
        ) : null}
      </header>

      {!today ? (
        <section className="card p-5">
          <h2 className="text-lg font-bold">Challenges unavailable</h2>
          <p className="mt-1 text-sm text-gray-500">Refresh the dashboard to load this week&apos;s challenge list.</p>
        </section>
      ) : (
        <section className="space-y-5">
          {!today.day && !today.openAllDays ? (
            <div className="card p-4">
              <h2 className="text-lg font-bold">No active challenge day</h2>
              <p className="mt-1 text-sm text-gray-500">Submissions open during the Monday through Friday challenge window.</p>
            </div>
          ) : null}
          {challengeDayOrder.map((day, index) => {
            const isActiveDay = today.day === day;
            const dayDate = challengeDate(today.challengeStartDate, index);
            const challenges = today.days[day];
            return (
              <div key={day}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold sm:text-xl">
                    {challengeDayLabels[day]} <span className="text-base font-semibold text-gray-500">{formatChallengeDate(dayDate)}</span>
                  </h2>
                  {isActiveDay ? <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase text-blue-900">Today</span> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {challenges.map((challenge) => {
                    const submitted = submissionsByChallenge.get(submissionKey(day, challenge.id));
                    const canSubmit = today.openAllDays || isActiveDay;
                    return (
                      <article className="card p-5" key={challenge.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold">{challenge.title}</h3>
                            <ChallengeDescription challenge={challenge} />
                          </div>
                          {submitted ? <StatusPill status={submitted.status} /> : null}
                        </div>
                        {submitted?.status === "verified" ? (
                          <p className="mt-4 text-sm font-semibold text-emerald-700">Verified · {submitted.pointsAwarded} points</p>
                        ) : canSubmit ? (
                          <ChallengeSubmit day={day} challenge={challenge} submitted={submitted} onSubmitted={load} />
                        ) : (
                          <p className="mt-4 text-sm font-semibold text-gray-500">Submissions open on {challengeDayLabels[day]} only.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold sm:text-xl">Teammates</h2>
          <span className="text-sm font-semibold text-gray-500">{teammates.length} players</span>
        </div>
        <div className="card divide-y divide-gray-200">
          {teammates.map((teammate) => (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4" key={teammate.uid}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-white">
                {teammate.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{teammate.displayName}</p>
                <p className="text-sm text-gray-500">
                  {teammate.completedToday}/{teammate.totalToday} submitted today
                </p>
              </div>
              {teammate.todayCompletions.length > 0 ? (
                <div className="flex items-center gap-1" aria-label="Today's challenges">
                  {teammate.todayCompletions.map((completion) => (
                    <span
                      key={completion.challengeId}
                      title={`${completion.title}: ${completion.status}`}
                      aria-label={`${completion.title} ${completion.status}`}
                      className={`h-2.5 w-2.5 rounded-full ${
                        completion.status === "verified"
                          ? "bg-emerald-500"
                          : completion.status === "pending"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                    />
                  ))}
                </div>
              ) : null}
              {teammate.streakDays >= 2 ? <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">🔥 {teammate.streakDays}</span> : null}
              <ChevronRight className="text-gray-400" size={18} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold sm:text-xl">My submissions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {history.slice(0, 6).map((submission) => (
            <article className="card p-4" key={submission.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{submission.challengeId}</p>
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
