// Applica db/schema.sql al database Neon indicato in DATABASE_URL.
// Uso: npm run db:init  (legge .env.local / .env oppure le variabili d'ambiente)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // file assente: si continua con le variabili d'ambiente
  }
}

// Per il DDL Neon consiglia la connessione diretta (non pooled): usiamo
// DATABASE_URL_UNPOOLED quando c'e' (viene creata da `neon deploy`), con
// fallback su DATABASE_URL per setup manuali.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL mancante. Copiala da Neon e mettila in .env.local (oppure esportala nel terminale).",
  );
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync("db/schema.sql", "utf8");
const statements = schema
  .split(";")
  .map((statement) => statement.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

console.log(`Applico ${statements.length} istruzioni SQL...`);
for (const statement of statements) {
  await sql.query(statement);
  console.log("  ok:", statement.split("\n")[0].slice(0, 70));
}
console.log("Database pronto.");
