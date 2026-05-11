import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import type { LeaderboardRow } from "@bootcamp/shared/types";

import { apiGet } from "../lib/api";

export function Leaderboard() {
  const [rows, setRows] = useState<readonly LeaderboardRow[]>([]);

  useEffect(() => {
    void apiGet<{ leaderboard: readonly LeaderboardRow[] }>("/api/leaderboard").then((payload) => setRows(payload.leaderboard));
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">Team race</p>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
      </header>
      <section className="card divide-y divide-gray-200">
        {rows.map((row) => (
          <div className="flex items-center gap-4 p-4" key={row.teamId}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: row.color }}>
              {row.rank === 1 ? <Trophy size={20} /> : row.rank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{row.name}</p>
              <p className="text-sm text-gray-500">{row.verifiedSubmissions} verified submissions</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{row.points}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">points</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
