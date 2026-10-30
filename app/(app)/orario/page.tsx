import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { WEEKDAY_NAMES, formatHours, todayISO, weekdayOf } from "@/lib/date";
import { addLesson, deleteLesson, duplicateDay, setWeeklySchedule } from "./actions";
import type { Lesson, Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function OrarioPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = requireUser();
  const params = await searchParams;
  const today = todayISO();
  const todayWeekday = weekdayOf(today);

  const [subjects, lessons] = await Promise.all([
    rows(`
      select id, name, color from subjects where user_id = ${user.id} order by name
    `),
    rows(`
      select l.id, l.subject_id, l.weekday,
                 to_char(l.start_time, 'HH24:MI') as start_time,
                 to_char(l.end_time, 'HH24:MI') as end_time,
                 s.name as subject_name, s.color
          from lessons l
          join subjects s on s.id = l.subject_id
          where l.user_id = ${user.id}
          order by l.weekday, l.start_time
    `),
  ]);

  const minutesFor = (weekday) =>
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
    <div>
      <h1 className="page-title">Orario settimanale</h1>
      <p className="page-sub">
        {lessons.length === 0
          ? "Inserisci le tue ore di scuola: giorno, materia e orario."
          : `${lessons.length} lezioni · ${formatHours(totalWeek)} di scuola a settimana`}
      </p>
      <Link href="/materie" className="btn btn-sm">
        Gestisci materie
      </Link>
      <div style={{ marginBottom: 18 }}>
        {subjects.length === 0 ? (
          <p>Prima di compilare l'orario devi creare almeno una materia.</p>
        ) : (
          <div className="grid grid-2">
            <section className="card">
              <h2 className="card-title">Aggiungi lezione</h2>
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
                </div>
                <SubmitButton className="btn btn-primary">Aggiungi</SubmitButton>
                <p className="tiny muted">
                  Ogni blocco può durare più ore (es. 08:00 10:00). Le ore totali del giorno si calcolano da sole.
                </p>
              </form>
            </section>

            <section className="card">
              <h2 className="card-title">Copia un giorno</h2>
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
                </div>
                <SubmitButton className="btn">Copia</SubmitButton>
                <p className="tiny muted">
                  Utile se hai sempre le stesse materie: le lezioni vengono aggiunte in coda al giorno di destinazione.
                </p>
              </form>
            </section>
          </div>
        )}
      </div>
      <section className="card" style={{ marginBottom: 18, marginTop: 16 }}>
        <h2 className="card-title">Imposta orario settimanale</h2>
        <p className="tiny muted">
          Definisci quante ore di scuola hai ogni giorno e quali materie per ciascun orario.
        </p>
        <form action={setWeeklySchedule} className="stack">
          {WEEKDAY_NAMES.map((name, index) => {
            const weekday = index + 1;
            const dayLessons = lessons.filter((lesson) => lesson.weekday === weekday);
            const hasExisting = dayLessons.length > 0;
            return (
              <div key={weekday} style={{ marginBottom: 12 }}>
                <label className="field grow">
                  <span>{name}</span>
                </label>
                <select className="select" name={`subject_${weekday}`} multiple>
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
                    <select className="select" name={`hours_${weekday}`} multiple>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                        <option key={h} value={h}>
                          {h} ore
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field grow" style={{ marginTop: 6 }}>
                    <span>Slot orario</span>
                    <input className="input" type="number" name={`slots_${weekday}`} min="0" max="10" value={hasExisting ? dayLessons.length : 0} disabled />
                  </label>
                </div>
                {hasExisting && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <p className="tiny muted">
                      Slot orari disponibili: 07:00-08:00, 08:00-09:00, 09:00-10:00, 10:00-11:00, 11:00-12:00, 12:00-13:00, 13:00-14:00, 14:00-15:00, 15:00-16:00, 16:00-17:00
                    </p>
                  </div>
                )}
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
      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="card-title">Anteprima orario settimanale</h2>
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: repeat(5, 1fr), gap: 4, marginBottom: 8 }}>
            {WEEKDAY_NAMES.map((name, i) => {
              const weekday = i + 1;
              const dayLessons = lessons.filter((lesson) => lesson.weekday === weekday);
              const daySlotCounts: Record<number, number> = {};
              dayLessons.forEach((lesson) => {
                const slotIdx = HOUR_SLOTS.findIndex((s) => s === `${lesson.start_time}:00-${lesson.end_time}:00`);
                if (slotIdx >= 0) daySlotCounts[slotIdx] = (daySlotCounts[slotIdx] || 0) + 1;
              });
              const activeSlots = Object.keys(daySlotCounts).length;
              return (
                <div key={name} style={{ padding: 4, borderRadius: 4, background: weekday === todayWeekday ? "var(--panel-soft)" : "transparent" }}>
                  <span style={{ fontWeight: 600, marginRight: 4 }}>{name}</span>
                  <span style={{ color: "var(--muted)" }}>{activeSlots > 0 ? `${activeSlots} slot(s)` : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <div className="grid grid-auto" style={{ marginTop: 18 }}>
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
              <h3 className="card-title" style={{ fontSize: 13.5 }}>
                {name}
                {weekday === todayWeekday ? (
                  <span className="badge" style={{ marginLeft: 6 }}>
                    oggi
                  </span>
                ) : null}
              </h3>
              <span className="tiny muted">
                {minutes > 0 ? formatHours(minutes) : "—"}
              </span>
              {dayLessons.length === 0 ? (
                <p className="tiny muted">Nessuna lezione.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 4, textAlign: "left", fontSize: 12, color: "var(--muted)" }}>Slot</th>
                      {["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((hour) => (
                        <th key={hour} style={{ padding: 4, textAlign: "center", fontSize: 12, borderBottom: "1px solid var(--line)" }}>
                          {hour}–{Number(hour.replace(":", "")) + 1 > 17 ? "17:00" : `${Number(hour.replace(":", "")) + 1}:00`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOUR_SLOTS.map((slot, slotIdx) => {
                      const slotLessons = dayLessons.filter((lesson) => {
                        const lessonStart = lesson.start_time;
                        const lessonEnd = lesson.end_time;
                        return (lessonStart <= slot && lessonEnd > slot) ||
                          (lessonStart < slot + ":00" && lessonEnd >= slot + ":00");
                      });
                      const hasLesson = slotLessons.length > 0;
                      const lesson = hasLesson ? slotLessons[0] : null;
                      return (
                        <tr key={slotIdx} style={{
                          borderBottom: "1px solid var(--line)",
                          height: 36,
                          display: "flex",
                          alignItems: "center",
                        }}>
                          <td style={{ padding: 4, fontSize: 12, color: "var(--muted)", width: 80 }}>
                            {slot}
                          </td>
                          {subjects.map((subject) => (
                            <td key={subject.id} style={{ padding: 4, textAlign: "center" }}>
                              {hasLesson && lesson.subject_id === subject.id ? (
                                <span style={{ background: subject.color, color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                                  ✓
                                </span>
                              ) : (
                                <span style={{ opacity: 0.3, fontSize: 10 }}>&nbsp;</span>
                              )
                            </td>
                          ))}
                          <td style={{ padding: 4, textAlign: "center", color: hasLesson ? "var(--foreground)" : "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                            {hasLesson ? (
                              <span style={{ color: lesson.color, fontWeight: 600 }}>
                                {lesson.subject_name}
                              </span>
                            ) : (
                              <span>—</span>
                            )
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
      {lessons.length > 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h2 className="card-title">Riepilogo settimana</h2>
          <span className="badge badge-ok">{formatHours(totalWeek)}</span>
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
    </div>
  );
}