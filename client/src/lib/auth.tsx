import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { Team, UserProfile } from "@bootcamp/shared/types";

import { apiGet } from "./api";
import { firebaseAuth } from "./firebase";

interface AuthContextValue {
  readonly firebaseUser: User | null;
  readonly profile: UserProfile | null;
  readonly team: Team | null;
  readonly loading: boolean;
  readonly refreshProfile: () => Promise<void>;
  readonly logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile(): Promise<void> {
    if (!firebaseAuth.currentUser) {
      setProfile(null);
      setTeam(null);
      return;
    }

    try {
      const payload = await apiGet<{ user: UserProfile; team: Team | null }>("/api/me");
      setProfile(payload.user);
      setTeam(payload.team);
    } catch {
      setProfile(null);
      setTeam(null);
    }
  }

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setLoading(true);
      void refreshProfile().finally(() => setLoading(false));
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      team,
      loading,
      refreshProfile,
      logout: async () => {
        await signOut(firebaseAuth);
        setProfile(null);
        setTeam(null);
      }
    }),
    [firebaseUser, loading, profile, team]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-sm text-gray-500">Loading</div>;
  }
  if (!auth.firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!auth.profile) {
    return <Navigate to="/register" replace />;
  }
  return <Outlet />;
}

export function CoachRoute() {
  const auth = useAuth();
  if (auth.profile?.role !== "coach") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function PlayerHomeRoute({ children }: { readonly children: ReactNode }) {
  const auth = useAuth();
  if (auth.profile?.role === "coach") {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
