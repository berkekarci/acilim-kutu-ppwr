import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }) {
  if (await isAdmin()) redirect("/yonetici");
  const sp = await searchParams;
  return <main className="admin-login"><form action={loginAction} className="login-card"><div className="brand"><div className="brandmark">AK</div><div className="brandtext"><strong>AÇILIM KUTU</strong><span>PPWR Yönetici Paneli</span></div></div><h1>Yönetici Girişi</h1>{sp?.hata && <div className="errorbox">Kullanıcı adı veya parola hatalı.</div>}<label>Kullanıcı adı<input name="username" autoComplete="username" required/></label><label>Parola<input name="password" type="password" autoComplete="current-password" required/></label><button className="admin-primary" type="submit">Giriş Yap</button></form></main>;
}
