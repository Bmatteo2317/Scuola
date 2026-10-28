import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import {
  WEEKDAY_SHORT,
  addMonths,
  dayLabel,
  formatLong,
  formatShort,
  isISO,
  monthGrid,
  monthLabel,
  startOfMonth,
  todayISO,
  weekdayOf,
} from "@/lib/date";
import { lessonTotalMinutes, openHomework, subjectWeekdays, withDueDates } from "@/lib/schedule";
import type { Homework, HomeworkRow, Lesson, ProjectEvent } from "@/lib/types";
import { formatHours } from "@/lib/date";
import { toggleHomework } from "../materie/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type CalItem = {
  key: string;
  label: string;
  time: string | null;
  color: string;
  kind: "lesson" | "homework" | "event";
};

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const month =
    params.m && /^\d{4}-\d{2}$/.test(params.m) ? `${params.m}-01` : startOfMonth(today);
  const selected = params.d && isISO(params.d) ? params.d : today;
  const grid = monthGrid(month);
  const gridStart = grid[0];
  const gridEnd = grid[grid.length - 1];

  const [lessons, homeworkRows, events] = await Promise.all([
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
          where e.user_id = ${user.id}
            and e.event_date between ${gridStart}::date and ${gridEnd}::date
          order by e.event_date, e.event_time nulls last`,
    ),
  ]);

  const weekdays = subjectWeekdays(lessons);
  const homework = withDueDates(homeworkRows, weekdays);

  const lessonsByWeekday = new Map<number, Lesson[]>();
  for (const lesson of lessons) {
    const list = lessonsByWeekday.get(lesson.weekday) ?? [];
    list.push(lesson);
    lessonsByWeekday.set(lesson.weekday, list);
  }

  const homeworkByDate = new Map<string, Homework[]>();
  for (const item of openHomework(homework)) {
    if (!item.due) continue;
    const list = homeworkByDate.get(item.due) ?? [];
    list.push(item);
    homeworkByDate.set(item.due, list);
  }

  const eventsByDate = new Map<string, ProjectEvent[]>();
  for (const event of events) {
    const list = eventsByDate.get(event.event_date) ?? [];
    list.push(event);
    eventsByDate.set(event.event_date, list);
  }

  const itemsFor = (iso: string): CalItem[] => {
    const dayLessons = lessonsByWeekday.get(weekdayOf(iso)) ?? [];
    const items: CalItem[] = [
      ...dayLessons.map((lesson) => ({
        key: `l-${lesson.id}`,
        kind: "lesson" as const,
        label: lesson.subject_name,
        time: lesson.start_time,
        color: lesson.color,
      })),
      ...(homeworkByDate.get(iso) ?? []).map((item) => ({
        key: `h-${item.id}`,
        kind: "homework" as const,
        label: item.title,
        time: null,
        color: item.subject_color,
      })),
      ...(eventsByDate.get(iso) ?? []).map((event) => ({
        key: `e-${event.id}`,
        kind: "event" as const,
        label: event.title,
        time: event.event_time,
        color: "#64748b",
      })),
    ];
    return items;
  };

  const selectedLessons = lessonsByWeekday.get(weekdayOf(selected)) ?? [];
  const selectedHomework = homeworkByDate.get(selected) ?? [];
  const selectedEvents = eventsByDate.get(selected) ?? [];

  const chipStyle = (item: CalItem) =>
    item.kind === "event"
      ? { background: "#f1f2fa", borderColor: "#dfe2f0", color: "#4b5069" }
      : { background: `${item.color}14`, borderColor: `${item.color}55`, color: item.color };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Calendario</h1>
          <p className="page-sub">
            Lezioni, compiti e impegni dei progetti, tutti nello stesso posto.
          </p>
        </div>
        <div className="cal-toolbar">
          <Link href={`/calendario?m=${addMonths(month, -1).slice(0, 7)}`} className="btn btn-sm">
            ←
          </Link>
          <Link href="/calendario" className="btn btn-sm">
            Oggi
          </Link>
          <Link href={`/calendario?m=${addMonths(month, 1).slice(0, 7)}`} className="btn btn-sm">
            →
          </Link>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="card-title" style={{ textTransform: "capitalize" }}>
            {monthLabel(month)}
          </h2>
          <div className="meta-row">
            <span className="badge">● lezioni</span>
            <span className="badge">┆ compiti</span>
            <span className="badge">📌 impegni</span>
          </div>
        </div>

        <div className="cal-scroll">
          <div className="cal-head">
            {WEEKDAY_SHORT.map((day) => (
              <div className="cal-head-cell" key={day}>
                {day}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {grid.map((iso) => {
              const inMonth = iso.slice(0, 7) === month.slice(0, 7);
              const items = itemsFor(iso);
              const visible = items.slice(0, 3);
              const hidden = items.length - visible.length;
              const classes = [
                "cal-cell",
                inMonth ? "" : "out",
                iso === today ? "today" : "",
                iso === selected ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <Link key={iso} href={`/calendario?m=${month.slice(0, 7)}&d=${iso}`} className={classes}>
                  <div className="cal-daynum">
                    <span>{Number(iso.slice(8, 10))}</span>
                  </div>
                  <div className="cal-chips">
                    {visible.map((item) => (
                      <span
                        key={item.key}
                        className={`chip ${item.kind === "lesson" ? "chip-lesson" : item.kind === "homework" ? "chip-hw" : "chip-event"}`}
                        style={{
                          ...chipStyle(item),
                          borderStyle: item.kind === "homework" ? "dashed" : "solid",
                        }}
                        title={item.label}
                      >
                        {item.kind === "event" ? "📌 " : ""}
                        {item.time ? `${item.time} ` : ""}
                        {item.label}
                      </span>
                    ))}
                    {hidden > 0 ? <span className="cal-more">+{hidden} altri</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">
              {formatLong(selected)}
            </h2>
            <p className="tiny muted">
              {selectedLessons.length > 0
                ? `${selectedLessons.length} ${selectedLessons.length === 1 ? "lezione" : "lezioni"} · ${formatHours(lessonTotalMinutes(selectedLessons))}`
                : "Nessuna lezione in programma"}
            </p>
          </div>
          <div className="row">
            <Link href="/materie" className="btn btn-sm btn-ghost">
              + Compito
            </Link>
            <Link href="/progetti" className="btn btn-sm btn-ghost">
              + Impegno
            </Link>
          </div>
        </div>

        <div className="grid grid-3" style={{ gap: 14 }}>
          <div>
            <p className="tiny muted" style={{ marginBottom: 7, fontWeight: 700 }}>
              LEZIONI
            </p>
            {selectedLessons.length === 0 ? (
              <p className="tiny muted">—</p>
            ) : (
              <ul className="stack" style={{ gap: 6 }}>
                {selectedLessons.map((lesson) => (
                  <li key={lesson.id} className="row" style={{ gap: 8 }}>
                    <span className="dot" style={{ background: lesson.color }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{lesson.subject_name}</div>
                      <div className="tiny muted">
                        {lesson.start_time}–{lesson.end_time}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="tiny muted" style={{ marginBottom: 7, fontWeight: 700 }}>
              COMPITI DA CONSEGNARE
            </p>
            {selectedHomework.length === 0 ? (
              <p className="tiny muted">—</p>
            ) : (
              <ul className="list" style={{ gap: 6 }}>
                {selectedHomework.map((item) => (
                  <li className="list-item" key={item.id} style={{ padding: "7px 9px" }}>
                    <span className="dot" style={{ background: item.subject_color }} />
                    <div className="item-main">
                      <div className="item-title" style={{ fontSize: 12.5 }}>
                        {item.title}
                      </div>
                      <div className="tiny muted">{item.subject_name}</div>
                    </div>
                    <form action={toggleHomework}>
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton className="icon-btn" title="Segna come fatto" pendingLabel="…">
                        ✓
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="tiny muted" style={{ marginBottom: 7, fontWeight: 700 }}>
              IMPEGNI
            </p>
            {selectedEvents.length === 0 ? (
              <p className="tiny muted">—</p>
            ) : (
              <ul className="stack" style={{ gap: 6 }}>
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{event.title}</div>
                    <div className="tiny muted">
                      {event.event_time ? `${event.event_time} · ` : ""}
                      <Link href={`/progetti/${event.project_id}`} style={{ color: "var(--accent)" }}>
                        {event.project_title}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {selectedLessons.length + selectedHomework.length + selectedEvents.length === 0 ? (
          <p className="empty" style={{ marginTop: 14 }}>
            Giornata libera. Seleziona un altro giorno o aggiungi un compito/impegno.
          </p>
        ) : null}
        <p className="tiny muted" style={{ marginTop: 12 }}>
          {dayLabel(selected, today)} · {formatShort(selected)}
        </p>
      </section>
    </>
  );
}
