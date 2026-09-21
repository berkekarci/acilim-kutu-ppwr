"use server";

import { login } from "@/lib/auth";

export async function loginAction(prevState, formData) {
  const result = await login(String(formData.get("username") || ""), String(formData.get("password") || ""));
  return result.ok ? { ok: true } : { ok: false, error: "Kullanıcı adı veya parola hatalı." };
}
