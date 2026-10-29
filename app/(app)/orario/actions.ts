"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { str, uuidOrNull } from "@/lib/form";

function refresh() {
  revalidatePath("/", "layout");
}

/** Imposta l'orario settimanale usando blocchi fissi di 1 ora.
 * Per ogni giorno (lun-dom) l'utente può selezionare quali ore scolastiche avere
 * e assegnare una materia a ciascun slot orario.
 * Gli slot sono: 07:00-08:00, 08:00-09:00, 09:00-10:00, 10:00-11:00, 11:00-12:00,
 * 12:00-13:00, 13:00-14:00, 14:00-15:00, 15:00-16:00, 16:00-17:00.
 * Vengono cancellate tutte le lezioni esistenti e sostituite con la nuova griglia.
 */
export async function setWeeklySchedule(formData: FormData) {
  const user = await requireUser();

  // Ore disponibili nella giornata scolastica (7:00 - 17:00 = 10 slot)
  const HOUR_SLOTS = [
    "07:00-08:00",
    "08:00-09:00",
    "09:00-10:00",
    "10:00-11:00",
    "11:00-12:00",
    "12:00-13:00",
    "13:00-14:00",
    "14:00-15:00",
    "15:00-16:00",
    "16:00-17:00",
  ];

  // Costruisci la griglia: per ogni giorno, quali slot sono selezionati e con quale materia
  const daysSchedule: Array<{
    weekday: number;
    selectedSubjectIds: string[]; // ID delle materie selezionate per gli slot attivi
  }> = [];

  for (let wd = 1; wd <= 7; wd++) {
    const selectedSubjectIds: string[] = [];

    // Per ciascuno slot orario, controlla se è stato selezionato una materia
    for (let slotIdx = 0; slotIdx < HOUR_SLOTS.length; slotIdx++) {
      const subjectId = uuidOrNull(formData.get(`subject_${wd}_${slotIdx}`));
      if (subjectId) {
        selectedSubjectIds.push(subjectId);
      }
    }

    daysSchedule.push({
      weekday: wd,
      selectedSubjectIds,
    });
  }

  // Elimina tutte le lezioni esistenti per questo utente
  await db()`delete from lessons where user_id = ${user.id}`;

  // Inserisci le nuove lezioni basate sulla griglia selezionata
  for (const day of daysSchedule) {
    for (let i = 0; i < day.selectedSubjectIds.length; i++) {
      // Lo slot orario corrispondente: slotIdx 0 = 07:00-08:00, slotIdx 1 = 08:00-09:00, ecc.
      const slotIdx = i; // i-esimo slot selezionato per questo giorno
      const [startH, startM] = HOUR_SLOTS[slotIdx].split(":")[0].split("-");
      const [endH, endM] = HOUR_SLOTS[slotIdx].split(":")[1].split("-");

      const startTime = `${startH.padStart(2, "0")}:${startM}`;
      const endTime = `${endH.padStart(2, "0")}:${endM}`;

      await db`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
                 values (${user.id}, ${day.selectedSubjectIds[i]}, ${day.weekday}, ${startTime}::time, ${endTime}::time)`;
    }
  }

  refresh();
  redirect("/orario");
}

/** Aggiunge una lezione singola (non sostituisce l'orario settimanale). */
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
    db`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
  );
  if (!subject) redirect("/orario");

  await db`insert into lessons (user_id, subject_id, weekday, start_time, end_time)
             values (${user.id}, ${subjectId}, ${weekday}, ${start}::time, ${end}::time)`;
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