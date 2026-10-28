"use server";

import { redirect } from "next/navigation";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { str } from "@/lib/form";

export type AuthState = { error?: string };

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export async function authAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode = str(formData.get("mode")) === "register" ? "register" : "login";
  const username = str(formData.get("username"));
  const password = str(formData.get("password"));

  if (!USERNAME_RE.test(username)) {
    return {
      error: "Nome utente: da 3 a 32 caratteri, solo lettere, numeri, punto, trattino e underscore.",
    };
  }
  if (password.length < 6) {
    return { error: "La password deve avere almeno 6 caratteri." };
  }

  const lower = username.toLowerCase();

  if (mode === "register") {
    const existing = await row<{ id: string }>(
      db()`select id from users where username_lower = ${lower}`,
    );
    if (existing) {
      return { error: "Questo nome utente è già stato preso." };
    }
    const created = await row<{ id: string }>(
      db()`insert into users (username, username_lower, password_hash)
          values (${username}, ${lower}, ${hashPassword(password)})
          returning id`,
    );
    if (!created) return { error: "Registrazione non riuscita, riprova." };
    await createSession(created.id);
    redirect("/");
  }

  const user = await row<{ id: string; password_hash: string }>(
    db()`select id, password_hash from users where username_lower = ${lower}`,
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Nome utente o password non corretti." };
  }

  await createSession(user.id);
  redirect("/");
}
