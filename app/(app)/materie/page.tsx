import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { dayLabel, formatHours, nowTime, todayISO } from "@/lib/date";
import { nextDueDate } from "@/lib/schedule";
import { createSubject } from "./actions";
import type { Lesson } from "@/lib/types";

export const dynamic = "force-dynamic";

type SubjectCard = {
  id: string;
  name: string;
  color: string;
  homework_open: number;
  files_count: number;
  lessons_count: number;
  minutes: number;
};

export default async function MateriePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const [subjects, lessons] = await Promise.all([
    rows<SubjectCard>(
      db()`select s.id, s.name, s.color,
                 (select count(*)::int from homework h where h.subject_id = s.id and h.done = false) as homework_open,
                 (select count(*)::int from files f where f.subject_id = s.id) as files_count,
                 (select count(*)::int from lessons l where l.subject_id = s.id) as lessons_count,
                 coalesce((
                   select sum(extract(epoch from (l.end_time - l.start_time)) / 60)::int
                   from lessons l where l.subject_id = s.id
                 ), 0) as minutes
          from subjects s
          where s.user_id = ${user.id}
          order by s.name`,
    ),
    rows<Pick<Lesson, "subject_id" | "weekday" | "end_time">>(
      db()`select subject_id, weekday, to_char(end_time, 'HH24:MI') as end_time
          from lessons where user_id = ${user.id}`,
    ),
  ]);

  const lessonsBySubject = new Map<string, { weekday: number; end_time: string }[]>();
  for (const lesson of lessons) {
    const list = lessonsBySubject.get(lesson.subject_id) ?? [];
    list.push({ weekday: lesson.weekday, end_time: lesson.end_time });
    lessonsBySubject.set(lesson.subject_id, list);
  }
  const now = nowTime();

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Materie</h1>
          <p className="page-sub">
            Ogni materia ha la sua sezione con compiti, cartelle e file.
          </p>
        </div>
      </header>

      {params.err ? (
        <p className="error" style={{ marginBottom: 14 }}>
          {params.err === "nome"
            ? "Scrivi il nome della materia."
            : params.err === "file"
              ? "Il file supera il limite di 4 MB."
              : "Operazione non riuscita, riprova."}
        </p>
      ) : null}

      <section className="card" style={{ marginBottom: 18 }}>
        <form action={createSubject} className="row-form">
          <label className="field grow">
            <span>Nuova materia</span>
            <input
              className="input"
              name="name"
              placeholder="Es. Italiano, Matematica, Storia…"
              maxLength={60}
              required
            />
          </label>
          <SubmitButton className="btn btn-primary">Crea materia</SubmitButton>
        </form>
      </section>

      {subjects.length === 0 ? (
        <p className="empty">
          Nessuna materia ancora. Creane una qui sopra: potrai aggiungere le ore in orario, i
          compiti e i materiali.
        </p>
      ) : (
        <div className="grid grid-auto">
          {subjects.map((subject) => {
            const next = nextDueDate(lessonsBySubject.get(subject.id) ?? [], today, now);
            return (
              <Link
                key={subject.id}
                href={`/materie/${subject.id}`}
                className="subject-card"
                style={{ borderTopColor: subject.color }}
              >
                <div className="row spread" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="subject-name">{subject.name}</div>
                    <div className="item-sub">
                      {next ? `Prossima lezione: ${dayLabel(next, today).toLowerCase()}` : "Nessuna ora in orario"}
                    </div>
                  </div>
                  <span className="muted">→</span>
                </div>

                <div className="meta-row">
                  {subject.homework_open > 0 ? (
                    <span className="badge badge-warn">{subject.homework_open} compiti</span>
                  ) : (
                    <span className="badge badge-ok">compiti a posto</span>
                  )}
                  <span className="badge">{subject.files_count} file</span>
                  <span className="badge">
                    {subject.lessons_count === 0
                      ? "0 ore"
                      : `${formatHours(subject.minutes)}/sett.`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
