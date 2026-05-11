import { db, FieldValue } from "../lib/firestore.js";

const teams = [
  { id: "lightning", name: "Team 1", joinCode: "LADY-NAVY-11", color: "#f59e0b", division: "high_school", sortOrder: 1 },
  { id: "comets", name: "Team 2", joinCode: "LADY-GOLD-22", color: "#2563eb", division: "high_school", sortOrder: 2 },
  { id: "storm", name: "Team 3", joinCode: "LADY-RED-33", color: "#dc2626", division: "high_school", sortOrder: 3 },
  { id: "phoenix", name: "Team 4", joinCode: "LADY-WHITE-44", color: "#7c3aed", division: "high_school", sortOrder: 4 },
  { id: "titans", name: "Team 5", joinCode: "LADY-GRAY-55", color: "#0f766e", division: "high_school", sortOrder: 5 },
  { id: "jr-high-10", name: "Team 10", joinCode: "LADY-JR-10", color: "#0891b2", division: "jr_high", sortOrder: 10 },
  { id: "jr-high-11", name: "Team 11", joinCode: "LADY-JR-11", color: "#be123c", division: "jr_high", sortOrder: 11 },
  { id: "jr-high-12", name: "Team 12", joinCode: "LADY-JR-12", color: "#4d7c0f", division: "jr_high", sortOrder: 12 },
  { id: "jr-high-13", name: "Team 13", joinCode: "LADY-JR-13", color: "#9333ea", division: "jr_high", sortOrder: 13 }
] as const;

async function main(): Promise<void> {
  const batch = db.batch();
  for (const team of teams) {
    batch.set(db.collection("teams").doc(team.id), {
      name: team.name,
      joinCode: team.joinCode,
      color: team.color,
      division: team.division,
      sortOrder: team.sortOrder,
      createdAt: FieldValue.serverTimestamp()
    });
  }
  await batch.commit();

  console.log("Seeded teams:");
  for (const team of teams) {
    console.log(`${team.name}: ${team.joinCode}`);
  }
}

await main();
