import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "ak_ppwr_admin";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET || "";
  if (value.length < 32) throw new Error("SESSION_SECRET en az 32 karakter olmalıdır.");
  return value;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function verifyCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || "";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedUser || expectedPass.length < 12) return false;
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPass);
}

export async function createAdminSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ exp, role: "admin" })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroyAdminSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  let expectedSignature;
  try {
    expectedSignature = sign(payload);
  } catch {
    return false;
  }
  if (!safeEqual(expectedSignature, signature)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/giris");
}
