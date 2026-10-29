import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { WEEKDAY_NAMES, formatHours, todayISO, weekdayOf } from "@/lib/date";
import { addLesson, deleteLesson, duplicateDay } from "./actions";
import type { Lesson, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrarioPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const todayWeekday = weekdayOf(today);

  const [subjects, lessons] = await Promise.all([
    rows<Subject>(
      db()`select id, name, color from subjects where user_id = ${user.id} order by name`,
    ),
    rows<Lesson>(
      db()`select l.id, l.subject_id, l.weekday,
                 to_char(l.start_time, 'HH24:MI') as start_time,
                 to_char(l.end_time, 'HH24:MI') as end_time,
                 s.name as subject_name, s.color
          from lessons l
          join subjects s on s.id = l.subject_id
          where l.user_id = ${user.id}
          order by l.weekday, l.start_time`,
    ),
  ]);

  const minutesFor = (weekday: number) =>
    lessons
      .filter((lesson) => lesson.weekday === weekday)
      .reduce((total, lesson) => {
        const [sh, sm] = lesson.start_time.split(":").map(Number);
        const [eh, em] = lesson.end_time.split(":").map(Number);
        return total + Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }, 0);

  const totalWeek = lessons.reduce((total, lesson) => {
    const [sh, sm] = lesson.start_time.split(":").map(Number);
    const [eh, em] = lesson.end_time.split(":").map(Number);
    return total + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Orario settimanale</h1>
          <p className="page-sub">
            {lessons.length === 0
              ? "Inserisci le tue ore di scuola: giorno, materia e orario."
              : `${lessons.length} lezioni · ${formatHours(totalWeek)} di scuola a settimana`}
          </p>
        </div>
        <Link href="/materie" className="btn btn-sm">
          Gestisci materie
        </Link>
      </header>

      {params.err === "orario" ? (
        <p className="error" style={{ marginBottom: 14 }}>
          Controlla gli orari: l&apos;ora di fine deve essere successiva a quella di inizio.
        </p>
      ) : null}
      {params.err === "copia" ? (
        <p className="error" style={{ marginBottom: 14 }}>
          Scegli due giorni diversi per la copia.
        </p>
      ) : null}
      {params.err === "file" ? (
        <p className="error" style={{ marginBottom: 14 }}>
          File troppo grande: il limite è 4 MB.
        </p>
      ) : null}

      {subjects.length === 0 ? (
        <section className="card">
          <p className="empty">
            Prima di compilare l&apos;orario devi creare almeno una materia.{" "}
            <Link href="/materie" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Vai alle materie →
            </Link>
          </p>
        </section>
      ) : (
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Aggiungi lezione</h2>
            </div>
            <form action={addLesson} className="stack">
              <div className="row-form">
                <label className="field grow">
                  <span>Giorno</span>
                  <select className="select" name="weekday" defaultValue={todayWeekday}>
                    {WEEKDAY_NAMES.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field grow">
                  <span>Materia</span>
                  <select className="select" name="subject_id" required>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row-form">
                <label className="field grow">
                  <span>Dalle</span>
                  <input className="input" type="time" name="start_time" defaultValue="08:00" required />
                </label>
                <label className="field grow">
                  <span>Alle</span>
                  <input className="input" type="time" name="end_time" defaultValue="09:00" required />
                </label>
                <SubmitButton className="btn btn-primary">Aggiungi</SubmitButton>
              </div>
              <p className="tiny muted">
                Ogni blocco può durare più ore (es. 08:00 → 10:00). Le ore totali del giorno si
                calcolano da sole.
              </p>
            </form>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Copia un giorno</h2>
            </div>
            <form action={duplicateDay} className="stack">
              <div className="row-form">
                <label className="field grow">
                  <span>Da</span>
                  <select className="select" name="from_weekday" defaultValue={1}>
                    {WEEKDAY_NAMES.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field grow">
                  <span>A</span>
                  <select className="select" name="to_weekday" defaultValue={2}>
                    {WEEKDAY_NAMES.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton className="btn">Copia</SubmitButton>
              </div>
              <p className="tiny muted">
                Utile se hai sempre le stesse materie: le lezioni vengono aggiunte in coda al
                giorno di destinazione.
              </p>
            </form>
          </section>
        </div>
      )}

      <section className="card" style={{ marginBottom: 18, marginTop: 16 }}>
        <div className="card-head">
          <h2 className="card-title">Imposta orario settimanale</h2>
          <p className="tiny muted">
            Definisci quante ore di scuola hai ogni giorno e l'orario di inizio. La fine sarà calcolata automaticamente.
          </p>
        </div>
        <form action={setWeeklySchedule} className="stack">
          {WEEKDAY_NAMES.map((name, index) => {
            const weekday = index + 1;
            const dayLessons = lessons.filter((lesson) => lesson.weekday === weekday);
            const hasExisting = dayLessons.length > 0;
            const startMin = hasExisting ? Number.parseInt(dayLessons[0].start_time.split(":")[1], 10) : 0;
            const endMin = hasExisting ? Number.parseInt(dayLessons[0].end_time.split(":")[1], 10) : 0;
            const existingHours = hasExisting ? Math.round((Number.parseInt(dayLessons[0].end_time.split(":")[0], 10) * 60 + endMin - (Number.parseInt(dayLessons[0].start_time.split(":")[0], 10) * 60 + startMin)) / 60) : 1;
            return (
              <div key={weekday} style={{ marginBottom: 12 }}>
                <label className="field grow">
                  <span>{name}</span>
                </label>
                <select className="select" name={`subject_${weekday}`} defaultValue={hasExisting ? dayLessons[0].subject_id : ""}>
                  <option value="">Scegli materia</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <div className="row-form" style={{ marginTop: 6 }}>
                  <label className="field grow">
                    <span>Ore</span>
                    <select className="select" name={`hours_${weekday}`}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                        <option key={h} value={h} selected={h === (hasExisting ? existingHours : 1)}>
                          {h} ora{' ' + (h > 1 ? "ore" : "ora")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field grow" style={{ marginTop: 6 }}>
                    <span>Dalle</span>
                    <input className="input" type="time" name={`start_${weekday}`} defaultValue={hasExisting ? dayLessons[0].start_time : "08:00"} />
                  </label>
                </div>
              </div>
            );
          })}
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <button className="btn btn-primary" type="submit">
              Salva orario settimanale
            </button>
          </div>
        </form>
      </section>

      <div className="grid grid-auto">
        {WEEKDAY_NAMES.map((name, index) => {
          const weekday = index + 1;
          const dayLessons = lessons.filter((lesson) => lesson.weekday === weekday);
          const minutes = minutesFor(weekday);
          return (
            <section
              className="card"
              key={name}
              style={{
                padding: 14,
                borderColor: weekday === todayWeekday ? "#c7c5ff" : undefined,
                boxShadow: weekday === todayWeekday ? "0 0 0 2px rgba(79,70,229,0.1)" : undefined,
              }}
            >
              <div className="card-head" style={{ marginBottom: 10 }}>
                <h3 className="card-title" style={{ fontSize: 13.5 }}>
                  {name}
                  {weekday === todayWeekday ? (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      oggi
                    </span>
                  ) : null}
                </h3>
                <span className="tiny muted">{minutes > 0 ? formatHours(minutes) : "—"}</span>
              </div>

              {dayLessons.length === 0 ? (
                <p className="tiny muted">Nessuna lezione.</p>
              ) : (
                <ul className="stack" style={{ gap: 6 }}>
                  {dayLessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="row spread"
                      style={{
                        gap: 6,
                        padding: "7px 9px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        borderLeft: `3px solid ${lesson.color}`,
                        background: "var(--panel-soft)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 650 }}>{lesson.subject_name}</div>
                        <div className="tiny muted">
                          {lesson.start_time}–{lesson.end_time}
                        </div>
                      </div>
                      <form action={deleteLesson}>
                        <input type="hidden" name="id" value={lesson.id} />
                        <ConfirmSubmit message={`Eliminare ${lesson.subject_name} di ${name}?`} title="Elimina">
                          ×
                        </ConfirmSubmit>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {lessons.length > 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <h2 className="card-title">Riepilogo settimana</h2>
            <span className="badge badge-ok">{formatHours(totalWeek)}</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {WEEKDAY_NAMES.map((name, index) => {
              const minutes = minutesFor(index + 1);
              const percent = totalWeek > 0 ? Math.round((minutes / totalWeek) * 100) : 0;
              return (
                <div key={name} className="row" style={{ gap: 10 }}>
                  <span className="tiny muted" style={{ width: 82 }}>
                    {name}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 999,
                      background: "#eef0f8",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                      }}
                    />
                  </div>
                  <span className="tiny muted" style={{ width: 60, textAlign: "right" }}>
                    {minutes > 0 ? formatHours(minutes) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
