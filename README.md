# Scuola

Agenda scolastica personale: orario settimanale, calendario, compiti che finiscono
automaticamente sulla prossima lezione della materia, materiali (cartelle e file) per ogni
materia e progetti con allegati e scadenze.

Stack: **Next.js 15** (App Router, Server Actions) + **Neon Postgres** + deploy su **Vercel**.
Nessun servizio extra: anche i file allegati stanno nel database Neon.

> **Requisiti**: Node.js 20.9 o superiore (Next.js 15 non parte con Node 16).

---

## Cosa puoi fare

- **Account personale**: registrazione e login con nome utente e password (hash `scrypt`, sessione
  in cookie firmato HMAC, httpOnly). Ogni utente vede solo i propri dati.
- **Orario settimanale**: per ogni giorno aggiungi i blocchi di scuola (materia + ora di inizio e
  fine). Le ore per giorno e per settimana si calcolano da sole; puoi copiare un giorno su un altro.
- **Calendario mensile**: mostra le lezioni ricorrenti, i compiti in consegna e gli impegni dei
  progetti. Clic su un giorno per l'agenda dettagliata.
- **Materie create da te**: ogni materia ha una sua sezione con compiti, cartelle, file e le ore in
  orario.
- **Compiti intelligenti**: quando aggiungi un compito, la consegna è **la prossima volta che hai
  quella materia** secondo il tuo orario. Se cambi orario, la data si ricalcola.
- **Progetti**: titolo, descrizione, file allegati, impegni messi in calendario (data e ora) e
  pulsante **Completato** per chiuderli (e riaprirli).

---

## 1. Crea il database su Neon

1. Vai su [neon.tech](https://neon.tech), crea un progetto (piano free) e copia la **connection
   string** dalla sezione *Connect* (deve finire con `?sslmode=require`).
2. Nel progetto locale crea il file `.env.local` (parti da `.env.example`):

   ```
   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
   AUTH_SECRET="una-stringa-casuale-lunga-almeno-16-caratteri"
   ```

   Per generare il segreto:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. Crea le tabelle (una volta sola, dal tuo computer):

   ```bash
   npm install
   npm run db:init
   ```

## 2. Avvia in locale

```bash
npm run dev
```

Apri http://localhost:3000, registra il tuo utente e inizia da **Materie → Orario**.

## 3. Pubblica su Vercel

1. Carica il progetto su GitHub (senza `.env.local`: è già in `.gitignore`).
2. Su [vercel.com](https://vercel.com) → **Add New → Project** → importa il repository. Il framework
   viene riconosciuto da solo (Next.js), non serve cambiare i comandi di build.
3. In **Settings → Environment Variables** aggiungi:
   - `DATABASE_URL` (la stessa connection string Neon)
   - `AUTH_SECRET` (lo stesso valore usato in locale, così le sessioni restano valide)
4. **Deploy**. Il database è già pronto perché `npm run db:init` è stato eseguito al punto 1.

Ogni futura modifica al codice: commit + push, Vercel rideploya da solo.

---

## Struttura del progetto

```
app/
  layout.tsx                 layout globale
  login/                     pagina di accesso + server action di login/registrazione
  (app)/                     area protetta (sidebar + pagine)
    page.tsx                 dashboard: oggi a scuola, compiti in arrivo, impegni
    calendario/page.tsx      calendario mensile
    orario/page.tsx          orario settimanale + azioni
    materie/                 elenco materie, dettaglio materia, azioni (compiti, cartelle, file)
    progetti/                elenco e dettaglio progetti + azioni
  api/files/[id]/route.ts    download file protetto (solo il proprietario)
components/                  componenti UI (navigazione, form, pulsanti)
lib/                         db Neon, autenticazione, date, logica compiti
db/schema.sql                schema del database
scripts/init-db.mjs          applica lo schema al database Neon
```

## Note tecniche

- **Password**: hash `scrypt` con salt casuale, confronto a tempo costante.
- **Sessioni**: cookie `HttpOnly` firmato con HMAC-SHA256, scadenza 30 giorni, `Secure` in
  produzione.
- **File**: salvati come `bytea` in Postgres, scaricati tramite route autenticata. Limite **4 MB per
  file** perché le funzioni Vercel accettano al massimo ~4,5 MB per richiesta. Se ti servono file
  più grandi si può aggiungere uno storage esterno (es. Vercel Blob o S3) senza toccare il resto.
- **Timezone**: le date "oggi" e i giorni della settimana sono calcolati su `Europe/Rome`.
- **Isolamento dati**: ogni query filtra per `user_id` preso dalla sessione, mai da input del
  browser.
