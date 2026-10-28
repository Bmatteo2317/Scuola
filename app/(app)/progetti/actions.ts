"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { isISO } from "@/lib/date";
import { str, uuidOrNull } from "@/lib/form";

function refresh() {
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const title = str(formData.get("title")).slice(0, 160);
  const description = str(formData.get("description")).slice(0, 4000) || null;
  if (!title) redirect("/progetti");

  const project = await row<{ id: string }>(
    db()`insert into projects (user_id, title, description)
             values (${user.id}, ${title}, ${description})
             returning id`,
  );
  refresh();
  redirect(project ? `/progetti/${project.id}` : "/progetti");
}

export async function toggleProject(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) redirect("/progetti");

  const project = await row<{ status: string }>(
    db()`select status from projects where id = ${id} and user_id = ${user.id}`,
  );
  if (!project) redirect("/progetti");

  if (project.status === "done") {
    await db()`update projects set status = 'active', completed_at = null
               where id = ${id} and user_id = ${user.id}`;
  } else {
    await db()`update projects set status = 'done', completed_at = now()
               where id = ${id} and user_id = ${user.id}`;
  }
  refresh();
  redirect(`/progetti/${id}`);
}

export async function deleteProject(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  if (!id) redirect("/progetti");

  await db()`delete from projects where id = ${id} and user_id = ${user.id}`;
  refresh();
  redirect("/progetti");
}

export async function addProjectEvent(formData: FormData) {
  const user = await requireUser();
  const projectId = uuidOrNull(formData.get("project_id"));
  const title = str(formData.get("title")).slice(0, 160);
  const date = str(formData.get("event_date"));
  const time = str(formData.get("event_time"));
  const notes = str(formData.get("notes")).slice(0, 2000) || null;

  if (!projectId) redirect("/progetti");
  const project = await row<{ id: string }>(
    db()`select id from projects where id = ${projectId} and user_id = ${user.id}`,
  );
  if (!project) redirect("/progetti");
  if (!title || !isISO(date)) redirect(`/progetti/${projectId}?err=data`);

  await db()`insert into project_events (user_id, project_id, title, event_date, event_time, notes)
             values (${user.id}, ${projectId}, ${title}, ${date}::date,
                     ${/^\d{2}:\d{2}$/.test(time) ? time : null}::time, ${notes})`;
  refresh();
  redirect(`/progetti/${projectId}`);
}

export async function deleteProjectEvent(formData: FormData) {
  const user = await requireUser();
  const id = uuidOrNull(formData.get("id"));
  const projectId = uuidOrNull(formData.get("project_id"));
  if (!id) redirect("/progetti");

  await db()`delete from project_events where id = ${id} and user_id = ${user.id}`;
  refresh();
  redirect(projectId ? `/progetti/${projectId}` : "/progetti");
}
