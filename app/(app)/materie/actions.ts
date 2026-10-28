"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, row, rows } from "@/lib/db";
import { todayISO, nowTime } from "@/lib/date";
import { MAX_FILE_BYTES, str, uuidOrNull } from "@/lib/form";
import { nextDueDate } from "@/lib/schedule";
import { SUBJECT_COLORS } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

function backTo(path: string, error?: string): never {
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}err=${error}` : path);
}

/* ---------------- Materie ---------------- */

export async function createSubject(formData: FormData) {
  const user = await requireUser();
  const name = str(formData.get("name")).slice(0, 60);
  if (!name) backTo("/materie");

  const counter = await row<{ n: number }>(
    db()`select count(*)::int as n from subjects where user_id = ${user.id}`,
  );
  const color = SUBJECT_COLORS[(counter?.n ?? 0) % SUBJECT_COLORS.length];

  await db()`insert into subjects (user_id, name, color)
             values (${user.id}, ${name}, ${color})
             on conflict (user_id, name) do nothing`;

  refresh();
  backTo("/materie");
}

export async function deleteSubject(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) backTo("/materie");

  await db()`delete from subjects where id = ${id} and user_id = ${user.id}`;
  refresh();
  backTo("/materie");
}

/* ---------------- Cartelle ---------------- */

export async function createFolder(formData: FormData) {
  const user = await requireUser();
  const subjectId = uuidOrNull(formData.get("subject_id"));
  const name = str(formData.get("name")).slice(0, 80);
  if (!subjectId) backTo("/materie");

  const subject = await row<{ id: string }>(
    db()`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
  );
  if (!subject) backTo("/materie");
  if (!name) backTo(`/materie/${subjectId}`);

  await db()`insert into folders (user_id, subject_id, name)
             values (${user.id}, ${subjectId}, ${name})`;
  refresh();
  backTo(`/materie/${subjectId}`);
}

export async function deleteFolder(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  const subjectId = uuidOrNull(formData.get("subject_id"));
  if (!id) backTo("/materie");

  await db()`delete from folders where id = ${id} and user_id = ${user.id}`;
  refresh();
  backTo(subjectId ? `/materie/${subjectId}` : "/materie");
}

/* ---------------- File ---------------- */

export async function uploadFile(formData: FormData) {
  const user = await requireUser();
  const subjectId = uuidOrNull(formData.get("subject_id"));
  const folderId = uuidOrNull(formData.get("folder_id"));
  const projectId = uuidOrNull(formData.get("project_id"));

  const back = projectId
    ? `/progetti/${projectId}`
    : subjectId
      ? `/materie/${subjectId}${folderId ? `?cartella=${folderId}` : ""}`
      : "/materie";

  const file = formData.get("file");
  if (!file || typeof file === "string" || file.size === 0) backTo(back);

  if (file.size > MAX_FILE_BYTES) {
    backTo(back, "Il file supera 4 MB, il limite delle funzioni Vercel.");
  }

  if (subjectId) {
    const subject = await row<{ id: string }>(
      db()`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
    );
    if (!subject) backTo("/materie");
  }
  if (folderId) {
    const folder = await row<{ id: string }>(
      db()`select id from folders where id = ${folderId} and user_id = ${user.id}`,
    );
    if (!folder) backTo(back);
  }
  if (projectId) {
    const project = await row<{ id: string }>(
      db()`select id from projects where id = ${projectId} and user_id = ${user.id}`,
    );
    if (!project) backTo("/progetti");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const name = file.name.slice(0, 180) || "file";
  const mime = file.type || "application/octet-stream";

  await db()`insert into files (user_id, subject_id, folder_id, project_id, name, mime, size, data)
             values (${user.id}, ${subjectId}, ${folderId}, ${projectId}, ${name}, ${mime},
                     ${bytes.length}, decode(${base64}, 'base64'))`;

  refresh();
  backTo(back);
}

export async function deleteFile(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  const back = str(formData.get("back")) || "/materie";
  if (!id) backTo(back);

  await db()`delete from files where id = ${id} and user_id = ${user.id}`;
  refresh();
  backTo(back.startsWith("/") ? back : "/materie");
}

/* ---------------- Compiti ---------------- */

export async function addHomework(formData: FormData) {
  const user = await requireUser();
  const subjectId = uuidOrNull(formData.get("subject_id"));
  const title = str(formData.get("title")).slice(0, 160);
  const notes = str(formData.get("notes")).slice(0, 2000) || null;
  if (!subjectId) backTo("/materie");

  const subject = await row<{ id: string }>(
    db()`select id from subjects where id = ${subjectId} and user_id = ${user.id}`,
  );
  if (!subject) backTo("/materie");
  if (!title) backTo(`/materie/${subjectId}`);

  // La consegna e' la prossima lezione di questa materia che deve ancora arrivare.
  const subjectLessons = await rows<{ weekday: number; end_time: string }>(
    db()`select weekday, to_char(end_time, 'HH24:MI') as end_time
        from lessons
        where user_id = ${user.id} and subject_id = ${subjectId}
        order by weekday, start_time`,
  );
  const due = nextDueDate(subjectLessons, todayISO(), nowTime());

  await db()`insert into homework (user_id, subject_id, title, notes, due_date)
             values (${user.id}, ${subjectId}, ${title}, ${notes}, ${due}::date)`;
  refresh();
  backTo(`/materie/${subjectId}`);
}

export async function toggleHomework(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) return;

  const homework = await row<{ done: boolean }>(
    db()`select done from homework where id = ${id} and user_id = ${user.id}`,
  );
  if (!homework) return;

  if (homework.done) {
    await db()`update homework set done = false, done_at = null
               where id = ${id} and user_id = ${user.id}`;
  } else {
    await db()`update homework set done = true, done_at = now()
               where id = ${id} and user_id = ${user.id}`;
  }
  refresh();
}

export async function deleteHomework(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) return;

  await db()`delete from homework where id = ${id} and user_id = ${user.id}`;
  refresh();
}
