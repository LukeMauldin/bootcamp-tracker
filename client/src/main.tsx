import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { AuthProvider, CoachRoute, PlayerHomeRoute, ProtectedRoute } from "./lib/auth";
import { Admin } from "./routes/Admin";
import { Dashboard } from "./routes/Dashboard";
import { Leaderboard } from "./routes/Leaderboard";
import { Login } from "./routes/Login";
import { Register } from "./routes/Register";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <PlayerHomeRoute>
                <Dashboard />
              </PlayerHomeRoute>
            }
          />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route element={<CoachRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
