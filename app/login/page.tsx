import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  return (
    <main className="auth">
      <div style={{ width: "100%", maxWidth: 390 }}>
        <div className="auth-brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="auth-title">Scuola</div>
            <div className="small muted">Orario, compiti, materiali e progetti</div>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
