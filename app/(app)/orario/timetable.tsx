"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_NAMES } from "@/lib/date";
import type { Lesson, Subject } from "@/lib/types";
import { saveTimetable } from "./actions";

type Config = { days: number[]; rows: number; start: string };
type Cells = Record<string, string>;

const STORAGE_KEY = "scuola:orario-grid";
const MAX_ROWS = 14;
const DEFAULT_CONFIG: Config = { days: [1, 2, 3, 4, 5], rows: 6, start: "08:00" };

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Ricava giorni/righe/ora di inizio dalle lezioni già salvate. */
function configFromLessons(lessons: Lesson[]): Config {
  if (lessons.length === 0) return DEFAULT_CONFIG;
  const days = Array.from(new Set(lessons.map((lesson) => lesson.weekday))).sort((a, b) => a - b);
  const start = lessons.reduce(
    (min, lesson) => (lesson.start_time < min ? lesson.start_time : min),
    lessons[0].start_time,
  );
  const rows = lessons.reduce((max, lesson) => {
    const begin = toMinutes(lesson.start_time);
    const end = toMinutes(lesson.end_time);
    const slot = Math.round((begin - toMinutes(start)) / 60);
    const span = Math.max(1, Math.round((end - begin) / 60));
    return Math.max(max, Math.max(0, slot) + span);
  }, 1);
  return { days, start, rows: Math.min(MAX_ROWS, Math.max(1, rows)) };
}

/** Converte le lezioni salvate in celle della griglia (chiave "giorno-slot"). */
function cellsFromLessons(lessons: Lesson[], start: string): Cells {
  const base = toMinutes(start);
  const cells: Cells = {};
  for (const lesson of lessons) {
    const begin = toMinutes(lesson.start_time);
    const end = toMinutes(lesson.end_time);
    const offset = begin - base;
    if (offset < 0 || offset % 60 !== 0) continue;
    const slot = offset / 60;
    const span = Math.max(1, Math.round((end - begin) / 60));
    for (let i = 0; i < span && slot + i < MAX_ROWS; i += 1) {
      cells[`${lesson.weekday}-${slot + i}`] = lesson.subject_id;
    }
  }
  return cells;
}

export function Timetable({ subjects, lessons }: { subjects: Subject[]; lessons: Lesson[] }) {
  const router = useRouter();
  const initial = configFromLessons(lessons);
  const [config, setConfig] = useState<Config>(initial);
  const [cells, setCells] = useState<Cells>(() => cellsFromLessons(lessons, initial.start));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Configurazione salvata nel browser (giorni visibili, righe, ora di inizio).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Config>;
        const days = Array.isArray(stored.days)
          ? stored.days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
          : [];
        const next: Config = {
          days: days.length > 0 ? days : DEFAULT_CONFIG.days,
          rows:
            typeof stored.rows === "number"
              ? Math.min(MAX_ROWS, Math.max(1, Math.round(stored.rows)))
              : DEFAULT_CONFIG.rows,
          start:
            typeof stored.start === "string" && /^\d{2}:\d{2}$/.test(stored.start)
              ? stored.start
              : DEFAULT_CONFIG.start,
        };
        setConfig(next);
        setCells(cellsFromLessons(lessons, next.start));
      }
    } catch {
      /* localStorage non disponibile: si usano i valori di default */
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* ignora */
    }
  }, [config, loaded]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const days = [...config.days].sort((a, b) => a - b);

  const toggleDay = (weekday: number) => {
    setConfig((prev) => {
      const active = prev.days.includes(weekday);
      const nextDays = active
        ? prev.days.filter((day) => day !== weekday)
        : [...prev.days, weekday].sort((a, b) => a - b);
      return { ...prev, days: nextDays.length > 0 ? nextDays : [weekday] };
    });
  };

  const assign = (weekday: number, slot: number, subjectId: string) => {
    setCells((prev) => ({ ...prev, [`${weekday}-${slot}`]: subjectId }));
    setSaved(false);
  };

  const clear = (weekday: number, slot: number) => {
    setCells((prev) => {
      const next = { ...prev };
      delete next[`${weekday}-${slot}`];
      return next;
    });
    setSaved(false);
  };

  const handleDrop = (event: React.DragEvent, weekday: number, slot: number) => {
    event.preventDefault();
    const subjectId = event.dataTransfer.getData("text/plain");
    if (subjectId) assign(weekday, slot, subjectId);
  };

  const handleCellClick = (weekday: number, slot: number) => {
    const key = `${weekday}-${slot}`;
    if (selected) {
      assign(weekday, slot, selected);
      return;
    }
    if (cells[key]) clear(weekday, slot);
  };

  const handleSave = () => {
    const payload = Object.entries(cells)
      .map(([key, subjectId]) => {
        const [weekday, slot] = key.split("-").map(Number);
        return { weekday, slot, subjectId };
      })
      .filter(
        (cell) =>
          cell.subjectId &&
          Number.isInteger(cell.weekday) &&
          cell.weekday >= 1 &&
          cell.weekday <= 7 &&
          Number.isInteger(cell.slot) &&
          cell.slot >= 0 &&
          cell.slot < MAX_ROWS,
      );

    startTransition(async () => {
      await saveTimetable({ start: config.start, cells: payload });
      setSaved(true);
      router.refresh();
    });
  };

  const hoursPerDay = (weekday: number) =>
    Object.keys(cells).filter((key) => key.startsWith(`${weekday}-`)).length;

  const totalHours = Object.keys(cells).length;

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="card-head">
        <h2 className="card-title">Orario settimanale</h2>
        <span className="tiny muted">{totalHours} h a settimana</span>
      </div>

      <div className="row-form" style={{ marginBottom: 12 }}>
        <div className="field grow">
          <span>Ore al giorno</span>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setConfig((prev) => ({ ...prev, rows: Math.max(1, prev.rows - 1) }))}
              aria-label="Togli una riga"
            >
              −
            </button>
            <span className="badge" style={{ minWidth: 64, justifyContent: "center" }}>
              {config.rows} {config.rows === 1 ? "ora" : "ore"}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                setConfig((prev) => ({ ...prev, rows: Math.min(MAX_ROWS, prev.rows + 1) }))
              }
              aria-label="Aggiungi una riga"
            >
              +
            </button>
          </div>
        </div>
        <label className="field grow">
          <span>Inizio lezioni</span>
          <input
            className="input"
            type="time"
            value={config.start}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, start: event.target.value || "08:00" }))
            }
          />
        </label>
      </div>

      <div style={{ marginBottom: 10 }}>
        <span className="tiny muted" style={{ display: "block", marginBottom: 6 }}>
          Giorni da mostrare
        </span>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {WEEKDAY_NAMES.map((name, index) => {
            const weekday = index + 1;
            const active = config.days.includes(weekday);
            return (
              <button
                key={name}
                type="button"
                className={active ? "btn btn-sm btn-primary" : "btn btn-sm"}
                onClick={() => toggleDay(weekday)}
                aria-pressed={active}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th
                style={{
                  border: "1px solid var(--line)",
                  padding: "6px 8px",
                  fontSize: 12,
                  color: "var(--muted)",
                  textAlign: "left",
                  width: 92,
                }}
              >
                Ora
              </th>
              {days.map((weekday) => (
                <th
                  key={weekday}
                  style={{
                    border: "1px solid var(--line)",
                    padding: "6px 8px",
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  {WEEKDAY_NAMES[weekday - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: config.rows }, (_, slot) => {
              const begin = toMinutes(config.start) + slot * 60;
              return (
                <tr key={slot}>
                  <th
                    scope="row"
                    style={{
                      border: "1px solid var(--line)",
                      padding: "4px 8px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      background: "var(--panel-soft)",
                    }}
                  >
                    {slot + 1}ª
                    <span className="tiny muted" style={{ display: "block", fontWeight: 400 }}>
                      {fromMinutes(begin)}–{fromMinutes(begin + 60)}
                    </span>
                  </th>
                  {days.map((weekday) => {
                    const subjectId = cells[`${weekday}-${slot}`];
                    const subject = subjectId
                      ? subjects.find((item) => item.id === subjectId)
                      : undefined;
                    return (
                      <td
                        key={weekday}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, weekday, slot)}
                        onClick={() => handleCellClick(weekday, slot)}
                        title={subject ? `${subject.name} — clicca per togliere` : "Trascina qui una materia"}
                        style={{
                          border: "1px solid var(--line)",
                          padding: 4,
                          height: 44,
                          cursor: "pointer",
                          textAlign: "center",
                          verticalAlign: "middle",
                          background: subject ? `${subject.color}1f` : undefined,
                          borderLeft: subject ? `3px solid ${subject.color}` : undefined,
                        }}
                      >
                        {subject ? (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{ fontSize: 12.5, fontWeight: 650, color: subject.color }}
                            >
                              {subject.name}
                            </span>
                            <button
                              type="button"
                              aria-label={`Togli ${subject.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                clear(weekday, slot);
                              }}
                              style={{
                                border: 0,
                                background: "transparent",
                                color: "var(--muted)",
                                cursor: "pointer",
                                fontSize: 14,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ) : (
                          <span className="tiny muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="tiny muted" style={{ display: "block", marginBottom: 6 }}>
          Materie: trascinale in un blocco (oppure selezionale e clicca il blocco)
        </span>
        {subjects.length === 0 ? (
          <p className="tiny muted">Nessuna materia: creala prima dalla pagina Materie.</p>
        ) : (
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {subjects.map((subject) => {
              const active = selected === subject.id;
              return (
                <button
                  key={subject.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", subject.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => setSelected(active ? null : subject.id)}
                  aria-pressed={active}
                  className="btn btn-sm"
                  style={{
                    borderColor: subject.color,
                    color: subject.color,
                    background: active ? `${subject.color}22` : undefined,
                    cursor: "grab",
                  }}
                >
                  {subject.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="row spread" style={{ marginTop: 16, gap: 10, alignItems: "center" }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {days.map((weekday) => (
            <span key={weekday} className="tiny muted">
              {WEEKDAY_NAMES[weekday - 1]}: {hoursPerDay(weekday)} h
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setCells({});
              setSaved(false);
            }}
          >
            Svuota
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={pending}>
            {pending ? "Salvo…" : "Salva orario"}
          </button>
        </div>
      </div>
      {saved ? <p className="tiny muted" style={{ marginTop: 8 }}>Orario salvato.</p> : null}
    </section>
  );
}