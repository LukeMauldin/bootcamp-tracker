import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import type { LeaderboardDetail, LeaderboardGroup } from "@bootcamp/shared/types";

import { StatusPill } from "../components/StatusPill";
import { apiGet } from "../lib/api";
import { useAuth } from "../lib/auth";

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function Leaderboard() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<readonly LeaderboardGroup[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [detailsByTeam, setDetailsByTeam] = useState<Record<string, LeaderboardDetail | undefined>>({});
  const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isCoach = profile?.role === "coach";

  useEffect(() => {
    void apiGet<{ leaderboard: readonly LeaderboardGroup[] }>("/api/leaderboard").then((payload) => setGroups(payload.leaderboard));
  }, []);

  async function toggleDetail(teamId: string): Promise<void> {
    setError(null);
    if (selectedTeamId === teamId) {
      setSelectedTeamId(null);
      return;
    }

    setSelectedTeamId(teamId);
    if (detailsByTeam[teamId]) {
      return;
    }

    setLoadingTeamId(teamId);
    try {
      const payload = await apiGet<{ detail: LeaderboardDetail }>(`/api/leaderboard/${teamId}`);
      setDetailsByTeam((current) => ({ ...current, [teamId]: payload.detail }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load leaderboard details");
    } finally {
      setLoadingTeamId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">Team race</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Leaderboard</h1>
      </header>
      {groups.map((group) => (
        <section className="card divide-y divide-gray-200" key={group.division}>
          <h2 className="p-4 text-sm font-bold uppercase tracking-wide text-slate-700">{group.label}</h2>
          {group.rows.map((row) => {
            const detail = detailsByTeam[row.teamId];
            const isSelected = selectedTeamId === row.teamId;
            return (
              <article key={row.teamId}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: row.color }}>
                    {row.rank === 1 ? <Trophy size={20} /> : row.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold">{row.name}</p>
                    <p className="text-sm text-gray-500">
                      {row.verifiedSubmissions} verified submissions
                      {row.adjustments !== 0 ? ` · ${formatSigned(row.adjustments)} adjustments` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums sm:text-2xl">{row.points}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">points</p>
                  </div>
                  {isCoach ? (
                    <button
                      aria-expanded={isSelected}
                      className="btn-secondary shrink-0 px-3"
                      disabled={loadingTeamId === row.teamId}
                      onClick={() => void toggleDetail(row.teamId)}
                      type="button"
                    >
                      {isSelected ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="hidden sm:inline">Details</span>
                    </button>
                  ) : null}
                </div>

                {isCoach && isSelected ? (
                  <div className="border-t border-gray-200 bg-slate-50 p-4">
                    {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
                    {loadingTeamId === row.teamId ? <p className="text-sm font-semibold text-gray-500">Loading details</p> : null}
                    {detail ? (
                      <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Players</p>
                            <p className="text-xl font-bold">{detail.players.length}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Verified points</p>
                            <p className="text-xl font-bold">{row.points - row.adjustments}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adjustments</p>
                            <p className="text-xl font-bold">{formatSigned(row.adjustments)}</p>
                          </div>
                        </div>

                        <div>
                          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Players</h2>
                          <ul className="space-y-2 md:hidden">
                            {detail.players.map((player) => (
                              <li key={player.uid} className="rounded-lg border border-gray-200 bg-white p-3">
                                <div className="flex items-baseline justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-900">{player.displayName}</p>
                                    <p className="truncate text-xs text-gray-500">{player.email}</p>
                                  </div>
                                  <p className="shrink-0 text-base font-bold tabular-nums">{player.totalPoints}</p>
                                </div>
                                <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                                  <div>
                                    <dt className="text-gray-500">Verified</dt>
                                    <dd className="font-semibold tabular-nums">{player.verifiedSubmissions}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-gray-500">Pending</dt>
                                    <dd className="font-semibold tabular-nums">{player.pendingSubmissions}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-gray-500">Rejected</dt>
                                    <dd className="font-semibold tabular-nums">{player.rejectedSubmissions}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-gray-500">Adj</dt>
                                    <dd className="font-semibold tabular-nums">{formatSigned(player.adjustments)}</dd>
                                  </div>
                                </dl>
                              </li>
                            ))}
                          </ul>
                          <table className="hidden w-full text-left text-sm md:table">
                            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                              <tr>
                                <th className="py-2 pr-3 font-semibold">Player</th>
                                <th className="px-3 py-2 font-semibold">Verified</th>
                                <th className="px-3 py-2 font-semibold">Pending</th>
                                <th className="px-3 py-2 font-semibold">Rejected</th>
                                <th className="px-3 py-2 font-semibold">Adjustments</th>
                                <th className="py-2 pl-3 text-right font-semibold">Points</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {detail.players.map((player) => (
                                <tr key={player.uid}>
                                  <td className="py-3 pr-3">
                                    <p className="font-semibold text-slate-900">{player.displayName}</p>
                                    <p className="text-xs text-gray-500">{player.email}</p>
                                  </td>
                                  <td className="px-3 py-3">{player.verifiedSubmissions}</td>
                                  <td className="px-3 py-3">{player.pendingSubmissions}</td>
                                  <td className="px-3 py-3">{player.rejectedSubmissions}</td>
                                  <td className="px-3 py-3">{formatSigned(player.adjustments)}</td>
                                  <td className="py-3 pl-3 text-right font-bold">{player.totalPoints}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Submissions</h2>
                          <div className="space-y-2">
                            {detail.submissions.map((submission) => (
                              <div className="rounded-lg border border-gray-200 bg-white p-3" key={submission.id}>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold">
                                      {submission.playerName} · {submission.challengeTitle}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {submission.dayDate} · {submission.challengeId}
                                      {submission.value !== null ? ` · value ${String(submission.value)}` : ""}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-3">
                                    <StatusPill status={submission.status} />
                                    <span className="text-sm font-bold">{submission.pointsAwarded} pts</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {detail.submissions.length === 0 ? <p className="text-sm text-gray-500">No submissions yet.</p> : null}
                          </div>
                        </div>

                        {detail.adjustments.length > 0 ? (
                          <div>
                            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Adjustments</h2>
                            <div className="space-y-2">
                              {detail.adjustments.map((adjustment) => (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm" key={adjustment.id}>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold">{adjustment.reason}</p>
                                    <p className="text-xs text-gray-500">{adjustment.playerName ?? detail.team.name}</p>
                                  </div>
                                  <p className="shrink-0 font-bold">{formatSigned(adjustment.points)} pts</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}
      {groups.length === 0 ? <p className="card p-4 text-sm text-gray-500">No leaderboard data yet.</p> : null}
    </div>
  );
}
