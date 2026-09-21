import { getPublicRecordByCode } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePdfSource(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "blob.vercel-storage.com" ||
        parsed.hostname.endsWith(".blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

function filenameFor(record, type) {
  const raw =
    type === "uygunluk-beyani"
      ? record.declaration_filename || "AB_Uygunluk_Beyani.pdf"
      : record.technical_filename || "Teknik_Dosya.pdf";

  const name = String(raw).trim() || "belge.pdf";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

export async function GET(request, { params }) {
  const { kod, tur } = await params;

  if (!["uygunluk-beyani", "teknik-dosya"].includes(tur)) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const record = await getPublicRecordByCode(decodeURIComponent(kod));
  if (!record) {
    return new Response("Kayıt bulunamadı.", { status: 404 });
  }

  const sourceUrl =
    tur === "uygunluk-beyani" ? record.declaration_url : record.technical_url;

  if (!sourceUrl || !safePdfSource(sourceUrl)) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const upstream = await fetch(sourceUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Belge alınamadı.", { status: 502 });
  }

  const download = new URL(request.url).searchParams.get("indir") === "1";
  const filename = filenameFor(record, tur);
  const encodedFilename = encodeURIComponent(filename);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
