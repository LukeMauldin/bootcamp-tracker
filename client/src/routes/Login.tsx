import { signInWithEmailAndPassword } from "firebase/auth";
import { LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { firebaseAuth } from "../lib/firebase";

export function Login() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
      setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      await auth.refreshProfile();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="card w-full max-w-md p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">Lady Sentinels</p>
        <h1 className="mt-2 text-3xl font-bold">Finish Strong</h1>
        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-semibold">
            Email
            <input className="field mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input className="field mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy}>
            <LogIn size={18} />
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          New player?{" "}
          <Link className="font-semibold text-blue-900" to="/register">
            Join with code
          </Link>
        </p>
      </section>
    </main>
  );
}
