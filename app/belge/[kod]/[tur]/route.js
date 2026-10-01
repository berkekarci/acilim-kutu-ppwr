import { getPublicRecordByCode } from "@/lib/db";

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
  const name = String(record.article5_filename || "Art5_PPWR_Uygunluk_Beyani.docx").trim();
  return /\.docx?$/i.test(name) ? name : `${name}.docx`;
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

  if (!["uygunluk-beyani", "teknik-dosya", "art-5-uygunluk-beyani"].includes(tur)) {
    return new Response("Belge bulunamadı.", { status: 404 });
  }

  const record = await getPublicRecordByCode(decodeURIComponent(kod));
  if (!record) {
    return new Response("Kayıt bulunamadı.", { status: 404 });
  }

  const sourceUrl = tur === "uygunluk-beyani"
    ? record.declaration_url
    : tur === "teknik-dosya"
      ? record.technical_url
      : record.article5_url;

  if (!sourceUrl || !safeBlobSource(sourceUrl)) {
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
      "Content-Type": contentTypeFor(filename, upstream.headers.get("content-type")),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
