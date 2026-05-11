import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiPost } from "../lib/api";
import { useAuth } from "../lib/auth";
import { firebaseAuth } from "../lib/firebase";

export function Register() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const createdHere = !firebaseAuth.currentUser;
    try {
      if (createdHere) {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      }
      await apiPost("/api/register", { displayName, joinCode });
      await firebaseAuth.currentUser?.getIdToken(true);
      await auth.refreshProfile();
      navigate("/", { replace: true });
    } catch (err) {
      if (createdHere && firebaseAuth.currentUser) {
        try {
          await signOut(firebaseAuth);
        } catch {
          // Best-effort local cleanup; the server has already deleted the auth user.
        }
      }
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="card w-full max-w-md p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">Team registration</p>
        <h1 className="mt-2 text-3xl font-bold">Join the challenge</h1>
        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          {!auth.firebaseUser ? (
            <>
              <label className="block text-sm font-semibold">
                Email
                <input className="field mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="block text-sm font-semibold">
                Password
                <input className="field mt-1" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
            </>
          ) : null}
          <label className="block text-sm font-semibold">
            Name
            <input className="field mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label className="block text-sm font-semibold">
            Join code
            <input className="field mt-1 uppercase" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} required />
          </label>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy}>
            <UserPlus size={18} />
            Register
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already registered?{" "}
          <Link className="font-semibold text-blue-900" to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
