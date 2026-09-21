import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }) {
  if (await isAdmin()) redirect("/yonetici");
  const sp = await searchParams;
  return <main className="admin-login"><form action={loginAction} className="login-card"><div className="brand corporate-brand"><div className="brand-logo-surface"><img className="brand-logo" src="https://acilimkutu.com/wp-content/uploads/2020/02/logo.webp" alt="Açılım Kutu" /></div><div className="brandtext brand-system"><strong>PPWR KAYIT SİSTEMİ</strong><span>Yönetici Paneli</span></div></div><h1>Yönetici Girişi</h1>{sp?.hata && <div className="errorbox">Kullanıcı adı veya parola hatalı.</div>}<label>Kullanıcı adı<input name="username" autoComplete="username" required/></label><label>Parola<input name="password" type="password" autoComplete="current-password" required/></label><button className="admin-primary" type="submit">Giriş Yap</button></form></main>;
}
