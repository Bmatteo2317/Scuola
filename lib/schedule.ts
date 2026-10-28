import { addDays, nextLessonDate, todayISO, weekdayOf } from "./date";
import type { Homework, HomeworkRow, Lesson } from "./types";

/** Mappa materia -> giorni della settimana in cui si fa lezione. */
export function subjectWeekdays(lessons: Pick<Lesson, "subject_id" | "weekday">[]) {
  const map = new Map<string, number[]>();
  for (const lesson of lessons) {
    const days = map.get(lesson.subject_id) ?? [];
    if (!days.includes(lesson.weekday)) days.push(lesson.weekday);
    map.set(lesson.subject_id, days.sort((a, b) => a - b));
  }
  return map;
}

/**
 * Data di consegna di un compito: la prima lezione di quella materia che deve
 * ancora arrivare. Se oggi c'e' lezione ma e' gia' finita, si passa alla volta
 * successiva.
 */
export function nextDueDate(
  lessons: { weekday: number; end_time: string }[],
  fromISO: string,
  timeHHMM: string,
): string | null {
  const days = Array.from(new Set(lessons.map((lesson) => lesson.weekday))).sort();
  for (let offset = 0; offset <= 120; offset += 1) {
    const date = addDays(fromISO, offset);
    const weekday = weekdayOf(date);
    if (!days.includes(weekday)) continue;
    if (offset === 0) {
      const stillToCome = lessons.some(
        (lesson) => lesson.weekday === weekday && lesson.end_time > timeHHMM,
      );
      if (!stillToCome) continue;
    }
    return date;
  }
  return null;
}

/**
 * La "consegna" di un compito e' la prima lezione di quella materia
 * dal giorno in cui il compito e' stato assegnato.
 */
export function withDueDates(rows: HomeworkRow[], weekdays: Map<string, number[]>): Homework[] {
  return rows.map((item) => ({
    ...item,
    due: item.due_date ?? nextLessonDate(weekdays.get(item.subject_id) ?? [], item.created_date),
  }));
}

export function sortHomework(list: Homework[]): Homework[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return a.title.localeCompare(b.title, "it");
  });
}

export function openHomework(list: Homework[]): Homework[] {
  return sortHomework(list.filter((item) => !item.done));
}

/** Compiti in ritardo: la lezione è già passata e il compito non è fatto. */
export function overdue(list: Homework[], today = todayISO()): Homework[] {
  return openHomework(list).filter((item) => item.due !== null && item.due < today);
}

export function lessonTotalMinutes(
  lessons: Pick<Lesson, "start_time" | "end_time">[],
): number {
  return lessons.reduce((total, lesson) => {
    const [sh, sm] = lesson.start_time.split(":").map(Number);
    const [eh, em] = lesson.end_time.split(":").map(Number);
    return total + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);
}
