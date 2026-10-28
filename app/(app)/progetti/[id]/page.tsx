import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db, row, rows } from "@/lib/db";
import { formatLong, formatShort, todayISO } from "@/lib/date";
import { fileIcon, formatBytes, isUuid } from "@/lib/form";
import { addProjectEvent, deleteProject, deleteProjectEvent, toggleProject } from "../actions";
import { deleteFile, uploadFile } from "../../materie/actions";
import type { FileRow, ProjectEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProjectDetail = {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "done";
  created_date: string;
  completed_date: string | null;
};

export default async function ProgettoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const today = todayISO();

  if (!isUuid(id)) notFound();

  const project = await row<ProjectDetail>(
    db()`select id, title, description, status,
               to_char(created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date,
               to_char(completed_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as completed_date
        from projects
        where id = ${id} and user_id = ${user.id}`,
  );
  if (!project) notFound();

  const [files, events] = await Promise.all([
    rows<FileRow>(
      db()`select id, name, mime, size, subject_id, folder_id, project_id,
                 to_char(created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date
          from files
          where user_id = ${user.id} and project_id = ${id}
          order by created_at desc`,
    ),
    rows<ProjectEvent>(
      db()`select id, project_id, title,
                 to_char(event_date, 'YYYY-MM-DD') as event_date,
                 to_char(event_time, 'HH24:MI') as event_time,
                 notes
          from project_events
          where user_id = ${user.id} and project_id = ${id}
          order by event_date, event_time nulls last`,
    ),
  ]);

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <Link href="/progetti" className="btn btn-sm btn-ghost">
          ← Progetti
        </Link>
      </div>

      <header className="page-head">
        <div>
          <h1 className="page-title">{project.title}</h1>
          <p className="page-sub">
            Creato il {formatShort(project.created_date)}
            {project.status === "done" && project.completed_date
              ? ` · completato il ${formatShort(project.completed_date)}`
              : ""}
          </p>
        </div>
        <div className="row">
          <form action={toggleProject}>
            <input type="hidden" name="id" value={project.id} />
            <SubmitButton
              className={project.status === "done" ? "btn btn-sm" : "btn btn-sm btn-primary"}
              pendingLabel="…"
            >
              {project.status === "done" ? "↩ Riapri progetto" : "✓ Segna completato"}
            </SubmitButton>
          </form>
          <form action={deleteProject}>
            <input type="hidden" name="id" value={project.id} />
            <ConfirmSubmit
              className="btn btn-sm btn-danger"
              message={`Eliminare il progetto “${project.title}”? Verranno eliminati anche file e impegni.`}
            >
              Elimina
            </ConfirmSubmit>
          </form>
        </div>
      </header>

      {query.err ? (
        <p className="error" style={{ marginBottom: 14 }}>
          {query.err === "file" ? "Il file supera il limite di 4 MB." : "Controlla la data dell'impegno."}
        </p>
      ) : null}

      {project.status === "done" ? (
        <p className="notice" style={{ marginBottom: 14 }}>
          Progetto completato. Puoi riaprirlo in qualsiasi momento.
        </p>
      ) : null}

      {project.description ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{project.description}</p>
        </section>
      ) : null}

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">File del progetto</h2>
            <span className="badge">{files.length}</span>
          </div>

          <form action={uploadFile} className="stack" style={{ marginBottom: 14 }}>
            <input type="hidden" name="project_id" value={project.id} />
            <label className="field">
              <span>Allega un file</span>
              <input className="input" type="file" name="file" required />
            </label>
            <SubmitButton className="btn">Carica</SubmitButton>
            <p className="tiny muted">Massimo 4 MB per file.</p>
          </form>

          {files.length === 0 ? (
            <p className="empty">Nessun file allegato.</p>
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
                    <input type="hidden" name="back" value={`/progetti/${project.id}`} />
                    <ConfirmSubmit message={`Eliminare ${file.name}?`}>×</ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Impegni in calendario</h2>
            <span className="badge">{events.length}</span>
          </div>

          <form action={addProjectEvent} className="stack" style={{ marginBottom: 14 }}>
            <input type="hidden" name="project_id" value={project.id} />
            <label className="field">
              <span>Cosa c&apos;è da fare</span>
              <input className="input" name="title" placeholder="Es. Consegna bozza, verifica in classe…" maxLength={160} required />
            </label>
            <div className="row-form">
              <label className="field grow">
                <span>Data</span>
                <input className="input" type="date" name="event_date" defaultValue={today} required />
              </label>
              <label className="field grow">
                <span>Ora (facoltativa)</span>
                <input className="input" type="time" name="event_time" />
              </label>
            </div>
            <label className="field">
              <span>Note (facoltative)</span>
              <textarea className="input" name="notes" maxLength={2000} />
            </label>
            <SubmitButton className="btn btn-primary">Aggiungi al calendario</SubmitButton>
          </form>

          {events.length === 0 ? (
            <p className="empty">Nessun impegno: aggiungine uno e comparirà nel calendario.</p>
          ) : (
            <ul className="list">
              {events.map((event) => {
                const past = event.event_date < today;
                return (
                  <li
                    className="list-item"
                    key={event.id}
                    style={past ? { opacity: 0.55 } : undefined}
                  >
                    <div className="item-main">
                      <div className="item-title">{event.title}</div>
                      <div className="item-sub">
                        {formatLong(event.event_date)}
                        {event.event_time ? ` · ${event.event_time}` : ""}
                        {event.notes ? ` · ${event.notes}` : ""}
                      </div>
                    </div>
                    <form action={deleteProjectEvent}>
                      <input type="hidden" name="id" value={event.id} />
                      <input type="hidden" name="project_id" value={project.id} />
                      <ConfirmSubmit message="Rimuovere questo impegno dal calendario?">×</ConfirmSubmit>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="tiny muted" style={{ marginTop: 18 }}>
        Suggerimento: crea un altro progetto quando vuoi — ogni progetto ha i suoi file e i suoi
        impegni.{" "}
        <Link href="/progetti" style={{ color: "var(--accent)" }}>
          Torna all&apos;elenco
        </Link>
        .
      </p>
    </>
  );
}
