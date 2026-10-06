import { getPublicRecordByCode } from "@/lib/db";
import { generateRecordPdf } from "@/lib/pdf-documents";
import { automaticPdfFilename } from "@/lib/document-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeBlobSource(url) {
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
  if (type === "uygunluk-beyani") {
    const name = String(record.declaration_filename || "AB_Uygunluk_Beyani.pdf").trim();
    return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
  }
  if (type === "teknik-dosya") {
    const name = String(record.technical_filename || "Teknik_Dosya.pdf").trim();
    return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
  }
  const originalName = String(record.article5_filename || "").trim();
  const extension = /\.doc$/i.test(originalName) ? "doc" : "docx";
  const shortCode = String(record.public_code || "PPWR")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "PPWR";
  return `ART5_${shortCode}.${extension}`;
}

function contentTypeFor(filename, upstreamType) {
  if (/\.docx$/i.test(filename)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (/\.doc$/i.test(filename)) return "application/msword";
  return upstreamType?.startsWith("application/pdf") ? upstreamType : "application/pdf";
}

export async function GET(request, { params }) {
  const { kod, tur } = await params;
  const isArticle5 = tur === "art-5-uygunluk-beyani" || /^art-5-uygunluk-beyani\.docx?$/i.test(tur);

  if (!["uygunluk-beyani", "teknik-dosya"].includes(tur) && !isArticle5) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const record = await getPublicRecordByCode(kod);
  if (!record) {
    return new Response("Kayıt bulunamadı.", { status: 404 });
  }

  const automatic = tur === "teknik-dosya" ? record.technical_auto : tur === "uygunluk-beyani" ? record.declaration_auto : false;
  if (automatic) {
    try {
      const bytes = await generateRecordPdf(record, tur);
      const download = new URL(request.url).searchParams.get("indir") === "1";
      const filename = encodeURIComponent(automaticPdfFilename(record.public_code, tur));
      return new Response(bytes, { headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      } });
    } catch (error) {
      console.error("PPWR PDF oluşturulamadı", { code: kod, type: tur, message: error.message });
      return new Response("PDF oluşturulamadı. Lütfen tekrar deneyin.", { status: 500 });
    }
  }

  const sourceUrl = tur === "uygunluk-beyani"
    ? record.declaration_url
    : tur === "teknik-dosya"
      ? record.technical_url
      : isArticle5
        ? record.article5_url
        : null;

  if (!sourceUrl || !safeBlobSource(sourceUrl)) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const upstream = await fetch(sourceUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Belge alınamadı.", { status: 502 });
  }

  const download = new URL(request.url).searchParams.get("indir") === "1";
  const filename = filenameFor(record, isArticle5 ? "art-5-uygunluk-beyani" : tur);
  const encodedFilename = encodeURIComponent(filename);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(filename, upstream.headers.get("content-type")),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
