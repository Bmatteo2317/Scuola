import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db, row, rows } from "@/lib/db";
import { WEEKDAY_SHORT, dayLabel, formatHours, nowTime, todayISO } from "@/lib/date";
import { fileIcon, formatBytes, isUuid } from "@/lib/form";
import { nextDueDate, sortHomework, withDueDates } from "@/lib/schedule";
import { toggleHomework, addHomework, deleteHomework, createFolder, deleteFolder, uploadFile, deleteFile, deleteSubject } from "../actions";
import type { FileRow, FolderRow, HomeworkRow, Lesson } from "@/lib/types";

export const dynamic = "force-dynamic";

type SubjectRow = { id: string; name: string; color: string };

export default async function MateriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cartella?: string; err?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const today = todayISO();

  if (!isUuid(id)) notFound();

  const subject = await row<SubjectRow>(
    db()`select id, name, color from subjects where id = ${id} and user_id = ${user.id}`,
  );
  if (!subject) notFound();

  const folderId = query.cartella && isUuid(query.cartella) ? query.cartella : null;

  const [lessons, homeworkRows, folders, files] = await Promise.all([
    rows<Lesson>(
      db()`select l.id, l.subject_id, l.weekday,
                 to_char(l.start_time, 'HH24:MI') as start_time,
                 to_char(l.end_time, 'HH24:MI') as end_time,
                 s.name as subject_name, s.color
          from lessons l
          join subjects s on s.id = l.subject_id
          where l.user_id = ${user.id} and l.subject_id = ${id}
          order by l.weekday, l.start_time`,
    ),
    rows<HomeworkRow>(
      db()`select h.id, h.subject_id, h.title, h.notes, h.done,
                 to_char(h.due_date, 'YYYY-MM-DD') as due_date,
                 to_char(h.created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date,
                 s.name as subject_name, s.color as subject_color
          from homework h
          join subjects s on s.id = h.subject_id
          where h.user_id = ${user.id} and h.subject_id = ${id}
          order by h.created_at desc`,
    ),
    rows<FolderRow>(
      db()`select f.id, f.name,
                 (select count(*)::int from files x where x.folder_id = f.id) as files_count
          from folders f
          where f.user_id = ${user.id} and f.subject_id = ${id}
          order by f.name`,
    ),
    rows<FileRow>(
      folderId
        ? db()`select id, name, mime, size, subject_id, folder_id, project_id,
                     to_char(created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date
              from files
              where user_id = ${user.id} and subject_id = ${id} and folder_id = ${folderId}
              order by created_at desc`
        : db()`select id, name, mime, size, subject_id, folder_id, project_id,
                     to_char(created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date
              from files
              where user_id = ${user.id} and subject_id = ${id} and folder_id is null
              order by created_at desc`,
    ),
  ]);

  const days = Array.from(new Set(lessons.map((lesson) => lesson.weekday))).sort((a, b) => a - b);
  const next = nextDueDate(lessons, today, nowTime());
  const weeklyMinutes = lessons.reduce((total, lesson) => {
    const [sh, sm] = lesson.start_time.split(":").map(Number);
    const [eh, em] = lesson.end_time.split(":").map(Number);
    return total + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);

  const homework = sortHomework(withDueDates(homeworkRows, new Map([[subject.id, days]])));
  const open = homework.filter((item) => !item.done);
  const done = homework.filter((item) => item.done);
  const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) ?? null : null;
  const backPath = `/materie/${id}${folderId ? `?cartella=${folderId}` : ""}`;

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <Link href="/materie" className="btn btn-sm btn-ghost">
          ← Materie
        </Link>
      </div>

      <header className="page-head">
        <div>
          <h1 className="page-title">
            <span
              className="dot dot-lg"
              style={{ background: subject.color, display: "inline-block", marginRight: 9 }}
            />
            {subject.name}
          </h1>
          <p className="page-sub">
            {next ? `Prossima lezione ${dayLabel(next, today).toLowerCase()}` : "Nessuna lezione in orario"}
            {lessons.length > 0
              ? ` · ${lessons.length} ${lessons.length === 1 ? "ora" : "ore"} a settimana (${days.map((day) => WEEKDAY_SHORT[day - 1]).join(", ")})`
              : ""}
            {weeklyMinutes > 0 ? ` · ${formatHours(weeklyMinutes)}` : ""}
          </p>
        </div>
        <div className="row">
          <Link href="/orario" className="btn btn-sm">
            Orario
          </Link>
          <form action={deleteSubject}>
            <input type="hidden" name="id" value={subject.id} />
            <ConfirmSubmit
              className="btn btn-sm btn-danger"
              message={`Eliminare ${subject.name}? Verranno eliminati anche compiti, cartelle e file.`}
            >
              Elimina materia
            </ConfirmSubmit>
          </form>
        </div>
      </header>

      {query.err ? (
        <p className="error" style={{ marginBottom: 14 }}>
          {query.err === "file" ? "Il file supera il limite di 4 MB." : "Operazione non riuscita."}
        </p>
      ) : null}

      <div className="grid grid-2">
        {/* ---------------- Compiti ---------------- */}
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Compiti</h2>
            <span className="badge">{open.length} aperti</span>
          </div>

          <form action={addHomework} className="stack" style={{ marginBottom: 16 }}>
            <input type="hidden" name="subject_id" value={subject.id} />
            <label className="field">
              <span>Cosa devi fare</span>
              <input
                className="input"
                name="title"
                placeholder="Es. Esercizi pag. 42, studiare capitolo 3…"
                maxLength={160}
                required
              />
            </label>
            <label className="field">
              <span>Note (facoltative)</span>
              <textarea className="input" name="notes" placeholder="Dettagli, pagine, link…" maxLength={2000} />
            </label>
            <SubmitButton className="btn btn-primary">Aggiungi compito</SubmitButton>
            <p className="tiny muted">
              {next
                ? `Lo metto per la prossima volta che hai ${subject.name}: ${dayLabel(next, today).toLowerCase()}.`
                : "Aggiungi le ore di questa materia in orario: il compito verrà messo per la lezione successiva."}
            </p>
          </form>

          {open.length === 0 ? (
            <p className="empty">Nessun compito aperto per {subject.name}. 🎉</p>
          ) : (
            <ul className="list">
              {open.map((item) => (
                <li className="list-item" key={item.id}>
                  <form action={toggleHomework} style={{ display: "flex" }}>
                    <input type="hidden" name="id" value={item.id} />
                    <SubmitButton className="icon-btn" title="Segna come fatto" pendingLabel="…">
                      ○
                    </SubmitButton>
                  </form>
                  <div className="item-main">
                    <div className="item-title">{item.title}</div>
                    <div className="item-sub">
                      {item.due ? `Per ${dayLabel(item.due, today).toLowerCase()}` : "Senza data: manca l'orario"}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </div>
                  </div>
                  <form action={deleteHomework}>
                    <input type="hidden" name="id" value={item.id} />
                    <ConfirmSubmit message="Eliminare questo compito?">×</ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {done.length > 0 ? (
            <>
              <div className="divider" style={{ margin: "14px 0 10px" }} />
              <p className="tiny muted" style={{ marginBottom: 8 }}>
                Completati ({done.length})
              </p>
              <ul className="list">
                {done.slice(0, 8).map((item) => (
                  <li className="list-item done" key={item.id}>
                    <form action={toggleHomework} style={{ display: "flex" }}>
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton className="icon-btn" title="Segna come da fare" pendingLabel="…">
                        ●
                      </SubmitButton>
                    </form>
                    <div className="item-main">
                      <div className="item-title">{item.title}</div>
                    </div>
                    <form action={deleteHomework}>
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmSubmit message="Eliminare questo compito?">×</ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* ---------------- Materiali ---------------- */}
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Materiali</h2>
            <span className="badge">{folders.length} cartelle</span>
          </div>

          {currentFolder ? (
            <div className="row spread" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8 }}>
                <Link href={`/materie/${id}`} className="btn btn-sm btn-ghost">
                  ← Tutte
                </Link>
                <strong style={{ fontSize: 14 }}>📁 {currentFolder.name}</strong>
              </div>
              <form action={deleteFolder}>
                <input type="hidden" name="id" value={currentFolder.id} />
                <input type="hidden" name="subject_id" value={id} />
                <ConfirmSubmit
                  className="btn btn-sm btn-danger"
                  message={`Eliminare la cartella ${currentFolder.name}? I file restano nella materia.`}
                >
                  Elimina cartella
                </ConfirmSubmit>
              </form>
            </div>
          ) : (
            <>
              {folders.length === 0 ? (
                <p className="empty" style={{ marginBottom: 12 }}>
                  Nessuna cartella: crea cartelle per dividere appunti, esercizi e verifiche.
                </p>
              ) : (
                <div className="stack" style={{ gap: 7, marginBottom: 14 }}>
                  {folders.map((folder) => (
                    <Link
                      key={folder.id}
                      href={`/materie/${id}?cartella=${folder.id}`}
                      className="folder-card"
                    >
                      <span className="folder-icon">📁</span>
                      <div className="item-main">
                        <div className="item-title">{folder.name}</div>
                        <div className="item-sub">{folder.files_count} file</div>
                      </div>
                      <span className="muted">→</span>
                    </Link>
                  ))}
                </div>
              )}

              <form action={createFolder} className="row-form" style={{ marginBottom: 14 }}>
                <input type="hidden" name="subject_id" value={id} />
                <label className="field grow">
                  <span>Nuova cartella</span>
                  <input className="input" name="name" placeholder="Es. Appunti, Verifiche…" maxLength={80} required />
                </label>
                <SubmitButton className="btn">Crea</SubmitButton>
              </form>
            </>
          )}

          <form action={uploadFile} className="stack" style={{ marginBottom: 14 }}>
            <input type="hidden" name="subject_id" value={id} />
            {currentFolder ? <input type="hidden" name="folder_id" value={currentFolder.id} /> : null}
            <label className="field">
              <span>Carica un file {currentFolder ? `in “${currentFolder.name}”` : "nella materia"}</span>
              <input className="input" type="file" name="file" required />
            </label>
            {!currentFolder && folders.length > 0 ? (
              <label className="field">
                <span>Cartella (facoltativa)</span>
                <select className="select" name="folder_id" defaultValue="">
                  <option value="">Nessuna, resta nella materia</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <SubmitButton className="btn">Carica file</SubmitButton>
            <p className="tiny muted">Massimo 4 MB per file (limite delle funzioni Vercel).</p>
          </form>

          {files.length === 0 ? (
            <p className="empty">
              {currentFolder ? "Cartella vuota." : "Nessun file nella materia."}
            </p>
          ) : (
            <ul className="list">
              {files.map((file) => (
                <li className="list-item" key={file.id}>
                  <span style={{ fontSize: 17 }}>{fileIcon(file.mime, file.name)}</span>
                  <div className="item-main">
                    <a className="item-title" href={`/api/files/${file.id}`} style={{ color: "var(--accent)" }}>
                      {file.name}
                    </a>
                    <div className="item-sub">
                      {formatBytes(file.size)} · {file.created_date}
                    </div>
                  </div>
                  <form action={deleteFile}>
                    <input type="hidden" name="id" value={file.id} />
                    <input type="hidden" name="back" value={backPath} />
                    <ConfirmSubmit message={`Eliminare ${file.name}?`}>×</ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
