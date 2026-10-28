import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

let client: Sql | null = null;

/** Client Neon (driver HTTP, perfetto su Vercel serverless). */
export function db(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL non impostata. Aggiungila in .env.local (locale) o nelle Environment Variables del progetto su Vercel.",
    );
  }
  if (!client) client = neon(url);
  return client;
}

/** Esegue una query e tipizza le righe. */
export async function rows<T>(query: PromiseLike<unknown>): Promise<T[]> {
  return (await query) as T[];
}

/** Esegue una query e restituisce la prima riga (o null). */
export async function row<T>(query: PromiseLike<unknown>): Promise<T | null> {
  const list = (await query) as T[];
  return list.length > 0 ? list[0] : null;
}
