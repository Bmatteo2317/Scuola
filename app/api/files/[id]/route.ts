import { getUser } from "@/lib/auth";
import { db, row } from "@/lib/db";
import { isUuid } from "@/lib/form";

export const dynamic = "force-dynamic";

type StoredFile = { name: string; mime: string; b64: string };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const { id } = await context.params;
  if (!isUuid(id)) return new Response("File non trovato", { status: 404 });

  const file = await row<StoredFile>(
    db()`select name, mime, encode(data, 'base64') as b64
        from files
        where id = ${id} and user_id = ${user.id}`,
  );
  if (!file) return new Response("File non trovato", { status: 404 });

  const bytes = Buffer.from(file.b64, "base64");
  const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
