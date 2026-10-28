"use client";

import { useActionState, useState } from "react";
import { authAction, type AuthState } from "@/app/login/actions";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [state, formAction] = useActionState<AuthState, FormData>(authAction, {});

  return (
    <div className="card auth-card">
      <div className="tabs">
        <button
          type="button"
          className={mode === "login" ? "tab active" : "tab"}
          onClick={() => setMode("login")}
        >
          Accedi
        </button>
        <button
          type="button"
          className={mode === "register" ? "tab active" : "tab"}
          onClick={() => setMode("register")}
        >
          Crea account
        </button>
      </div>

      <form action={formAction} className="stack">
        <input type="hidden" name="mode" value={mode} />

        <label className="field">
          <span>Nome utente</span>
          <input
            className="input"
            name="username"
            autoComplete="username"
            placeholder="es. mario.rossi"
            minLength={3}
            maxLength={32}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Almeno 6 caratteri"
            minLength={6}
            required
          />
        </label>

        {state.error ? <p className="error">{state.error}</p> : null}

        <SubmitButton className="btn btn-primary btn-block" pendingLabel="Un attimo…">
          {mode === "login" ? "Entra" : "Crea il mio account"}
        </SubmitButton>

        <p className="small muted" style={{ textAlign: "center" }}>
          {mode === "login"
            ? "Non hai ancora un account? Crealo in un secondo."
            : "I tuoi dati restano nel tuo database Neon."}
        </p>
      </form>
    </div>
  );
}
