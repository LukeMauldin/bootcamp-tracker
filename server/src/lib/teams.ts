import type { Team, TeamDivision } from "@bootcamp/shared/types";

export const TEAM_DIVISION_ORDER: readonly TeamDivision[] = ["high_school", "jr_high"];

export const TEAM_DIVISION_LABELS: Record<TeamDivision, string> = {
  high_school: "High School",
  jr_high: "Jr High"
};

const legacySortOrder = new Map([
  ["lightning", 1],
  ["comets", 2],
  ["storm", 3],
  ["phoenix", 4],
  ["titans", 5]
]);

function isTeamDivision(value: unknown): value is TeamDivision {
  return value === "high_school" || value === "jr_high";
}

function inferSortOrder(id: string, name: unknown): number {
  const legacy = legacySortOrder.get(id);
  if (legacy) {
    return legacy;
  }
  if (typeof name === "string") {
    const match = /^Team\s+(\d+)$/i.exec(name.trim());
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  return 999;
}

export function normalizeTeam(id: string, data: FirebaseFirestore.DocumentData | undefined): Team {
  const source = data ?? {};
  return {
    id,
    name: typeof source.name === "string" ? source.name : id,
    joinCode: typeof source.joinCode === "string" ? source.joinCode : "",
    color: typeof source.color === "string" ? source.color : "#1d4ed8",
    division: isTeamDivision(source.division) ? source.division : "high_school",
    sortOrder: typeof source.sortOrder === "number" ? source.sortOrder : inferSortOrder(id, source.name),
    createdAt: source.createdAt
  };
}

export function compareTeams(left: Team, right: Team): number {
  const leftDivision = TEAM_DIVISION_ORDER.indexOf(left.division);
  const rightDivision = TEAM_DIVISION_ORDER.indexOf(right.division);
  return leftDivision - rightDivision || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
}
