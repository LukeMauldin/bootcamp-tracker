import { db, FieldValue } from "../lib/firestore.js";

const teams = [
  { id: "lightning", name: "Lightning", joinCode: "LADY-NAVY-11", color: "#f59e0b" },
  { id: "comets", name: "Comets", joinCode: "LADY-GOLD-22", color: "#2563eb" },
  { id: "storm", name: "Storm", joinCode: "LADY-RED-33", color: "#dc2626" },
  { id: "phoenix", name: "Phoenix", joinCode: "LADY-WHITE-44", color: "#7c3aed" },
  { id: "titans", name: "Titans", joinCode: "LADY-GRAY-55", color: "#0f766e" }
] as const;

async function main(): Promise<void> {
  const batch = db.batch();
  for (const team of teams) {
    batch.set(db.collection("teams").doc(team.id), {
      name: team.name,
      joinCode: team.joinCode,
      color: team.color,
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
