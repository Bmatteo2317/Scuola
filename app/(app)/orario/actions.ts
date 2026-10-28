"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { str, uuidOrNull } from "@/lib/form";

function refresh() {
  revalidatePath("/", "layout");
}

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
