import { NavLinks } from "@/components/nav-links";
import { requireUser } from "@/lib/auth";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">Scuola</div>
            <div className="brand-sub">Agenda &amp; materiali</div>
          </div>
        </div>

        <NavLinks />

        <div className="user-box">
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{user.username}</div>
            <div className="user-role">Il tuo account</div>
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-sm btn-ghost">
              Esci
            </button>
          </form>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
