import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, row, rows } from "@/lib/db";
import {
  WEEKDAY_NAMES,
  addDays,
  dayLabel,
  formatHours,
  formatLong,
  formatShort,
  nowTime,
  todayISO,
  weekdayOf,
} from "@/lib/date";
import {
  lessonTotalMinutes,
  openHomework,
  overdue,
  subjectWeekdays,
  withDueDates,
} from "@/lib/schedule";
import type { HomeworkRow, Lesson, ProjectEvent, Subject } from "@/lib/types";
import { toggleHomework } from "./materie/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type Counters = { projects: number; files: number; homework_open: number };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayISO();

  const [subjects, lessons, homeworkRows, events, counters] = await Promise.all([
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
    rows<HomeworkRow>(
      db()`select h.id, h.subject_id, h.title, h.notes, h.done,
                 to_char(h.due_date, 'YYYY-MM-DD') as due_date,
                 to_char(h.created_at at time zone 'Europe/Rome', 'YYYY-MM-DD') as created_date,
                 s.name as subject_name, s.color as subject_color
          from homework h
          join subjects s on s.id = h.subject_id
          where h.user_id = ${user.id}
          order by h.created_at desc`,
    ),
    rows<ProjectEvent>(
      db()`select e.id, e.project_id, e.title,
                 to_char(e.event_date, 'YYYY-MM-DD') as event_date,
                 to_char(e.event_time, 'HH24:MI') as event_time,
                 e.notes, p.title as project_title
          from project_events e
          join projects p on p.id = e.project_id
          where e.user_id = ${user.id} and e.event_date >= ${today}::date
          order by e.event_date, e.event_time nulls last
          limit 6`,
    ),
    row<Counters>(
      db()`select
             (select count(*)::int from projects where user_id = ${user.id} and status = 'active') as projects,
             (select count(*)::int from files where user_id = ${user.id}) as files,
             (select count(*)::int from homework where user_id = ${user.id} and done = false) as homework_open`,
    ),
  ]);

  const weekdays = subjectWeekdays(lessons);
  const homework = withDueDates(homeworkRows, weekdays);
  const pending = openHomework(homework);
  const late = overdue(homework, today);
  const todayLessons = lessons.filter((lesson) => lesson.weekday === weekdayOf(today));
  const todayMinutes = lessonTotalMinutes(todayLessons);

  // Prossima lezione in assoluto (oggi compreso, saltando quelle già finite)
  const now = nowTime();
  let nextLesson: { lesson: Lesson; date: string } | null = null;
  for (let offset = 0; offset <= 7 && !nextLesson; offset += 1) {
    const date = addDays(today, offset);
    const dayLessons = lessons
      .filter((lesson) => lesson.weekday === weekdayOf(date))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const candidate =
      offset === 0
        ? dayLessons.find((lesson) => lesson.end_time > now)
        : dayLessons[0];
    if (candidate) nextLesson = { lesson: candidate, date };
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Ciao, {user.username} 👋</h1>
          <p className="page-sub">{formatLong(today)}</p>
        </div>
        <div className="row">
          <Link href="/orario" className="btn btn-sm">
            Orario
          </Link>
          <Link href="/materie" className="btn btn-sm btn-primary">
            + Nuovo compito
          </Link>
        </div>
      </header>

      <section className="hero" style={{ marginBottom: 16 }}>
        <div>
          <div className="tiny" style={{ opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Prossima lezione
          </div>
          {nextLesson ? (
            <>
              <h2 style={{ marginTop: 4 }}>
                <span className="dot dot-lg" style={{ background: nextLesson.lesson.color, display: "inline-block", marginRight: 8 }} />
                {nextLesson.lesson.subject_name}
              </h2>
              <p className="hero-sub">
                {WEEKDAY_NAMES[weekdayOf(nextLesson.date) - 1]} {formatShort(nextLesson.date)} ·{" "}
                {nextLesson.lesson.start_time}–{nextLesson.lesson.end_time}
              </p>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 4 }}>Nessuna lezione in orario</h2>
              <p className="hero-sub">
                Aggiungi il tuo orario settimanale per far comparire le lezioni nel calendario.
              </p>
            </>
          )}
        </div>
        <div className="hero-stat">
          <strong>{todayLessons.length === 0 ? "—" : formatHours(todayMinutes)}</strong>
          <span>{todayLessons.length === 0 ? "nessuna lezione oggi" : "scuola oggi"}</span>
        </div>
      </section>

      <section className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-value">{subjects.length}</div>
          <div className="stat-label">Materie</div>
        </div>
        <div className="stat">
          <div className="stat-value">{pending.length}</div>
          <div className="stat-label">Compiti aperti</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: late.length > 0 ? "var(--danger)" : undefined }}>
            {late.length}
          </div>
          <div className="stat-label">In ritardo</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counters?.projects ?? 0}</div>
          <div className="stat-label">Progetti attivi</div>
        </div>
      </section>

      {subjects.length === 0 ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2 className="card-title">Inizia da qui</h2>
          </div>
          <div className="stack">
            <p className="small muted">
              Tre passaggi e l&apos;agenda è pronta: crea le materie, inserisci le ore di scuola
              della settimana e poi aggiungi i compiti.
            </p>
            <div className="row">
              <Link href="/materie" className="btn btn-primary btn-sm">
                1. Crea le materie
              </Link>
              <Link href="/orario" className="btn btn-sm">
                2. Compila l&apos;orario
              </Link>
              <Link href="/progetti" className="btn btn-sm">
                3. Aggiungi un progetto
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Oggi a scuola</h2>
            <span className="badge">
              {todayLessons.length === 0 ? "Libero" : formatHours(todayMinutes)}
            </span>
          </div>
          {todayLessons.length === 0 ? (
            <p className="empty">Nessuna lezione oggi.</p>
          ) : (
            <div className="timeline">
              {todayLessons.map((lesson) => (
                <div className="timeline-item" key={lesson.id}>
                  <div className="timeline-time">
                    {lesson.start_time}
                    <br />
                    <span className="muted">{lesson.end_time}</span>
                  </div>
                  <div className="item-main">
                    <div className="item-title">
                      <span
                        className="dot"
                        style={{ background: lesson.color, display: "inline-block", marginRight: 7 }}
                      />
                      {lesson.subject_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Compiti in arrivo</h2>
            <Link href="/materie" className="btn btn-sm btn-ghost">
              Aggiungi
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="empty">Nessun compito aperto. 🎉</p>
          ) : (
            <ul className="list">
              {pending.slice(0, 5).map((item) => {
                const isLate = item.due !== null && item.due < today;
                return (
                  <li className="list-item" key={item.id}>
                    <span className="dot" style={{ background: item.subject_color }} />
                    <div className="item-main">
                      <div className="item-title">{item.title}</div>
                      <div className="item-sub">
                        {item.subject_name}
                        {item.due ? ` · per ${dayLabel(item.due, today).toLowerCase()}` : " · aggiungi l'orario di questa materia"}
                      </div>
                    </div>
                    {isLate ? <span className="badge badge-danger">in ritardo</span> : null}
                    <form action={toggleHomework} className="item-actions">
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton className="icon-btn" title="Segna come fatto" pendingLabel="…">
                        ✓
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Prossimi impegni</h2>
            <Link href="/progetti" className="btn btn-sm btn-ghost">
              Progetti
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="empty">
              Nessun impegno in calendario. Nei progetti puoi aggiungere scadenze e verifiche.
            </p>
          ) : (
            <ul className="list">
              {events.map((event) => (
                <li className="list-item" key={event.id}>
                  <div className="item-main">
                    <div className="item-title">
                      <Link href={`/progetti/${event.project_id}`}>{event.title}</Link>
                    </div>
                    <div className="item-sub">
                      {formatShort(event.event_date)}
                      {event.event_time ? ` · ${event.event_time}` : ""} · {event.project_title}
                    </div>
                  </div>
                  <Link href={`/progetti/${event.project_id}`} className="btn btn-sm btn-ghost">
                    Apri
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Scorciatoie</h2>
          </div>
          <div className="stack">
            <Link href="/calendario" className="folder-card">
              <span className="folder-icon">🗓️</span>
              <div className="item-main">
                <div className="item-title">Calendario del mese</div>
                <div className="item-sub">Lezioni, compiti e impegni</div>
              </div>
              <span className="muted">→</span>
            </Link>
            <Link href="/orario" className="folder-card">
              <span className="folder-icon">⏰</span>
              <div className="item-main">
                <div className="item-title">Orario settimanale</div>
                <div className="item-sub">Quando hai scuola e quali materie</div>
              </div>
              <span className="muted">→</span>
            </Link>
            <Link href="/progetti" className="folder-card">
              <span className="folder-icon">📁</span>
              <div className="item-main">
                <div className="item-title">Progetti</div>
                <div className="item-sub">
                  {counters?.files ?? 0} file caricati in totale
                </div>
              </div>
              <span className="muted">→</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
