"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, { ok: false });
  return (
    <main className="admin-login">
      <form action={action} className="login-card">
        <div className="brand"><div className="brandmark">AK</div><div className="brandtext"><strong>AÇILIM KUTU</strong><span>PPWR Yönetim Paneli</span></div></div>
        <h1>Yönetici Girişi</h1>
        {state?.error && <div className="errorbox">{state.error}</div>}
        <label>Kullanıcı adı<input name="username" autoComplete="username" required /></label>
        <label>Parola<input type="password" name="password" autoComplete="current-password" required /></label>
        <button className="admin-primary" type="submit" disabled={pending}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button>
      </form>
    </main>
  );
}
