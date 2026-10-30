"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { str, uuidOrNull } from "@/lib/form";

function refresh() {
  revalidatePath("/", "layout");
}

type TimetableCell = { weekday: number; slot: number; subjectId: string };

function timeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Salva la tabella orario: ogni cella piena (giorno + slot) diventa una lezione di 1 ora. */
export async function saveTimetable(payload: {
  start: string;
  cells: TimetableCell[];
}) {
  const user = await requireUser();
  const start = /^\d{2}:\d{2}$/.test(payload.start) ? payload.start : "08:00";

  // Verifica che le materie appartengano all'utente.
  const subjectIds = Array.from(new Set(payload.cells.map((cell) => cell.subjectId))).filter(
    Boolean,
  );
  const allowed = new Set<string>();
  for (const subjectId of subjectIds) {
    const subject = await row<{ id: string }>(
      db()`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
    );
    if (subject) allowed.add(subject.id);
  }

  const [startH, startM] = start.split(":").map(Number);
  const base = (startH || 0) * 60 + (startM || 0);

  await db()`delete from lessons where user_id = ${user.id}`;

  for (const cell of payload.cells) {
    if (!allowed.has(cell.subjectId)) continue;
    if (!Number.isInteger(cell.weekday) || cell.weekday < 1 || cell.weekday > 7) continue;
    if (!Number.isInteger(cell.slot) || cell.slot < 0 || cell.slot > 23) continue;

    const begin = base + cell.slot * 60;
    const end = begin + 60;
    const startTime = timeLabel(begin);
    const endTime = timeLabel(end);

    await db()`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
             values (${user.id}, ${cell.subjectId}, ${cell.weekday}, ${startTime}::time, ${endTime}::time)`;
  }

  refresh();
}

/** Aggiunge una lezione singola (non tocca il resto dell'orario). */
export async function addLesson(formData: FormData) {
  const user = await requireUser();
  const subjectId = uuidOrNull(formData.get("subject_id"));
  const weekday = Number(str(formData.get("weekday")));
  const start = str(formData.get("start_time"));
  const end = str(formData.get("end_time"));

  if (!subjectId || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    redirect("/orario");
  }
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start) {
    redirect("/orario?err=orario");
  }

  const subject = await row<{ id: string }>(
    db()`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
  );
  if (!subject) redirect("/orario");

  await db()`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
           values (${user.id}, ${subjectId}, ${weekday}, ${start}::time, ${end}::time)`;
  refresh();
  redirect("/orario");
}

export async function deleteLesson(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) redirect("/orario");

  await db()`delete from lessons where id = ${id} and user_id = ${user.id}`;
  refresh();
  redirect("/orario");
}

/** Copia tutte le lezioni di un giorno in un altro (comodo per orari regolari). */
export async function duplicateDay(formData: FormData) {
  const user = await requireUser();
  const from = Number(str(formData.get("from_weekday")));
  const to = Number(str(formData.get("to_weekday")));

  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from === to ||
    from < 1 ||
    from > 7 ||
    to < 1 ||
    to > 7
  ) {
    redirect("/orario?err=copia");
  }

  await db()`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
           select user_id, subject_id, ${to}, start_time, end_time
           from lessons
           where user_id = ${user.id} and weekday = ${from}`;
  refresh();
  redirect("/orario");
}