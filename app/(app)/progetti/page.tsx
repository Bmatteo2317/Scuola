import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { dayLabel, formatShort, todayISO } from "@/lib/date";
import { createProject } from "./actions";
import type { ProjectRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProgettiPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const projects = await rows<ProjectRow>(
    db()`select p.id, p.title, p.description, p.status,
               to_char(p.created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date,
               (select count(*)::int from files f where f.project_id = p.id) as files_count,
               (select count(*)::int from project_events e where e.project_id = p.id) as events_count,
               (select to_char(min(e.event_date), 'YYYY-MM-DD') from project_events e
                 where e.project_id = p.id and e.event_date >= ${today}::date) as next_event
        from projects p
        where p.user_id = ${user.id}
        order by case when p.status = 'active' then 0 else 1 end, p.created_at desc`,
  );

  const active = projects.filter((project) => project.status === "active");
  const completed = projects.filter((project) => project.status === "done");

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Progetti</h1>
          <p className="page-sub">
            Ricerche, presentazioni, laboratori: allega i file, segna gli impegni in calendario e
            chiudi quando hai finito.
          </p>
        </div>
      </header>

      {params.err === "file" ? (
        <p className="error" style={{ marginBottom: 14 }}>
          Il file supera il limite di 4 MB.
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2 className="card-title">Nuovo progetto</h2>
        </div>
        <form action={createProject} className="stack">
          <label className="field">
            <span>Titolo</span>
            <input
              className="input"
              name="title"
              placeholder="Es. Presentazione di storia, Relazione di laboratorio…"
              maxLength={160}
              required
            />
          </label>
          <label className="field">
            <span>Descrizione (facoltativa)</span>
            <textarea className="input" name="description" placeholder="Cosa bisogna fare, con chi, entro quando…" maxLength={4000} />
          </label>
          <div>
            <SubmitButton className="btn btn-primary">Crea progetto</SubmitButton>
          </div>
        </form>
      </section>

      <section style={{ marginBottom: 18 }}>
        <div className="row spread" style={{ marginBottom: 10 }}>
          <h2 className="card-title">In corso</h2>
          <span className="badge">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <p className="empty">Nessun progetto in corso.</p>
        ) : (
          <div className="grid grid-auto">
            {active.map((project) => (
              <Link key={project.id} href={`/progetti/${project.id}`} className="subject-card" style={{ borderTopColor: "#4f46e5" }}>
                <div className="row spread" style={{ alignItems: "flex-start" }}>
                  <div className="subject-name">{project.title}</div>
                  <span className="muted">→</span>
                </div>
                {project.description ? (
                  <p className="item-sub" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {project.description}
                  </p>
                ) : null}
                <div className="meta-row">
                  <span className="badge">
                    {project.files_count} file
                  </span>
                  <span className="badge">
                    {project.events_count} impegni
                  </span>
                  {project.next_event ? (
                    <span className="badge badge-warn">
                      {dayLabel(project.next_event, today)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 ? (
        <section>
          <div className="row spread" style={{ marginBottom: 10 }}>
            <h2 className="card-title">Completati</h2>
            <span className="badge badge-ok">{completed.length}</span>
          </div>
          <ul className="list">
            {completed.map((project) => (
              <li className="list-item done" key={project.id}>
                <span style={{ color: "var(--ok)", fontWeight: 700 }}>✓</span>
                <div className="item-main">
                  <div className="item-title">
                    <Link href={`/progetti/${project.id}`}>{project.title}</Link>
                  </div>
                  <div className="item-sub">
                    {project.files_count} file · creato il {formatShort(project.created_date)}
                  </div>
                </div>
                <Link href={`/progetti/${project.id}`} className="btn btn-sm btn-ghost">
                  Apri
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
