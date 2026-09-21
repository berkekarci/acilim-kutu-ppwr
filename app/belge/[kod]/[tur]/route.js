import { getPublicRecordByCode } from "@/lib/db";
import { createPackagingTechnicalPdf } from "@/lib/autoTechnicalPdf";

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

  if (!["uygunluk-beyani", "teknik-dosya", "ambalaj-kimlik-teknik"].includes(tur)) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const record = await getPublicRecordByCode(decodeURIComponent(kod));
  if (!record) {
    return new Response("Kayıt bulunamadı.", { status: 404 });
  }

  if (tur === "ambalaj-kimlik-teknik") {
    try {
      const base = (process.env.NEXT_PUBLIC_APP_URL || "https://ppwr.acilimkutu.com").replace(/\/$/, "");
      const publicUrl = `${base}/${encodeURIComponent(record.public_code)}`;
      const pdf = await createPackagingTechnicalPdf(record, publicUrl);
      const download = new URL(request.url).searchParams.get("indir") === "1";
      const filename = `AK_PPWR_Ambalaj_Kimlik_Teknik_Bilgi_${record.public_code}.pdf`;
      const encodedFilename = encodeURIComponent(filename);
      return new Response(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedFilename}`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error("Otomatik PPWR PDF oluşturulamadı:", error);
      return new Response("PDF oluşturulamadı.", { status: 500 });
    }
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
