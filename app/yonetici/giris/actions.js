"use server";
import { redirect } from "next/navigation";
import { createAdminSession, verifyCredentials } from "@/lib/auth";

export async function loginAction(formData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  if (!verifyCredentials(username, password)) redirect("/yonetici/giris?hata=1");
  await createAdminSession();
  redirect("/yonetici");
}
