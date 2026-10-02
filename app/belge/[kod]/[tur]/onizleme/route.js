import { NextResponse } from "next/server";
import { getPublicRecordByCode } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { kod, tur } = await params;
  if (tur !== "art-5-uygunluk-beyani") {
    return new Response("Belge bulunamadı.", { status: 404 });
  }
  const record = await getPublicRecordByCode(kod);
  if (!record?.article5_url) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const extension = /\.doc$/i.test(record.article5_filename || "") ? "doc" : "docx";
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://ppwr.acilimkutu.com";
  const source = new URL(`/belge/${encodeURIComponent(record.public_code)}/art-5-uygunluk-beyani.${extension}`, origin);
  // Give Office a new source URL when a record's document has been updated.
  if (record.updated_at) source.searchParams.set("v", new Date(record.updated_at).getTime().toString());
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(request.headers.get("user-agent") || "");
  // Use Office's compact viewer as a full-page navigation on phones.
  // Both endpoints render the original Word file; no HTML conversion is applied.
  const viewer = new URL(isMobile
    ? "https://view.officeapps.live.com/op/embed.aspx"
    : "https://view.officeapps.live.com/op/view.aspx");
  viewer.searchParams.set("src", source.toString());
  const response = NextResponse.redirect(viewer, 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "User-Agent");
  return response;
}
