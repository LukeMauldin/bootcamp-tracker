import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import { ZodError } from "zod";

import { adminRouter } from "./routes/admin.js";
import { challengesRouter } from "./routes/challenges.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { meRouter } from "./routes/me.js";
import { registerRouter } from "./routes/register.js";
import { submissionsRouter } from "./routes/submissions.js";
import { teamsRouter } from "./routes/teams.js";
import { HttpError } from "./http.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use(cors());
app.use("/api", express.json({ limit: "1mb" }));
app.use("/api", express.urlencoded({ extended: false }));

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/register", registerRouter);
app.use("/api/me", meRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api", teamsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistCandidates = [
  process.env.CLIENT_DIST,
  path.resolve(process.cwd(), "client/dist"),
  path.resolve(process.cwd(), "../client/dist"),
  path.resolve(__dirname, "../../client/dist")
].filter(Boolean) as string[];
const clientDist = clientDistCandidates.find((candidate) => fs.existsSync(candidate));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", details: err.flatten() });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`bootcamp-tracker listening on :${port}`);
});
