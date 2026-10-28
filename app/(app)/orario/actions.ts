"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { str, uuidOrNull } from "@/lib/form";

function refresh() {
  revalidatePath("/", "layout");
}

/** Imposta l'orario settimanale: per ogni giorno della settimana (1-7) specifica:
 *  - quante ore di scuola vuoi (es. 1, 2, 3, 4 ore)
 *  - l'orario di inizio (es. 08:00)
 *  - l'orario di fine (verrà calcolato in base alle ore + inizio)
 * Sostituisce tutte le lezioni esistenti con i nuovi orari.
 */
export async function setWeeklySchedule(formData: FormData) {
  const user = await requireUser();

  // Giorni della settimana: lun=1, mar=2, mer=3, gio=4, ven=5, sab=6, dom=7
  const days: Array<{ weekday: number; hours: number; start_time: string }> = [];

  for (let wd = 1; wd <= 7; wd++) {
    const hours = Number(str(formData.get(`hours_${wd}`)));
    const start = str(formData.get(`start_${wd}`));

    days.push({
      weekday: wd,
      hours: hours || 0,
      start_time: start,
    });
  }

  // Elimina tutte le lezioni esistenti per questo utente
  await db()`delete from lessons where user_id = ${user.id}`;

  // Inserisci i nuovi blocchi orari per ogni giorno
  for (const day of days) {
    if (day.hours <= 0 || !/^\d{2}:\d{2}$/.test(day.start_time)) {
      continue;
    }

    // Calcola la fine: ore * 60 minuti dall'inizio
    const [sh, sm] = day.start_time.split(":").map(Number);
    const totalMinutes = sh * 60 + + Number.parseInt(day.start_time.split(":")[1], 10) + day.hours * 60;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    const end_time = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

    await db`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
               values (${user.id}, ${null}, ${day.weekday}, ${day.start_time}::time, ${end_time}::time)`;
  }

  refresh();
  redirect("/orario");
}

export async function addLesson(formData: FormData) {
  const user = await requireUser();
  const subjectId = uuidOrNull(formData.get("subject_id"));
  const weekday = Number(str(formData.get("weekday")));
  const start = str(formData.get("start_time"));
  const hours = Number(str(formData.get("hours"))) || 1;

  if (!subjectId || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    redirect("/orario");
  }
  if (!/^\d{2}:\d{2}$/.test(start)) {
    redirect("/orario");
  }

  const subject = await row<{ id: string }>(
    db`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
  );
  if (!subject) redirect("/orario");

  // Calcola la fine basandosi sulle ore
  const [sh, sm] = start.split(":").map(Number);
  const totalMinutes = sh * 60 + + Number.parseInt(start.split(":")[1], 10) + hours * 60;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  const end_time = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

  await db`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
             values (${user.id}, ${subjectId}, ${weekday}, ${start}::time, ${end_time}::time)`;
  refresh();
  redirect("/orario");
}

export async function deleteLesson(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) redirect("/orario");

  await db`delete from lessons where id = ${id} and user_id = ${user.id}`;
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

  await db`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
             select user_id, subject_id, ${to}, start_time, end_time
             from lessons
             where user_id = ${user.id} and weekday = ${from}`;
  refresh();
  redirect("/orario");
}