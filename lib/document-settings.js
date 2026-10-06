export const TECHNICAL_PDF_TITLE = "PPWR Ambalaj Kimlik ve Teknik Bilgi Belgesi / PPWR Packaging Identification & Technical Information Document";

export function hasTechnicalPdf(record) {
  return Boolean(record.technical_auto || record.technical_url);
}

export function hasDeclarationPdf(record) {
  return Boolean(record.declaration_auto || record.declaration_url);
}

export function recordUrl(code) {
  return `https://ppwr.acilimkutu.com/${encodeURIComponent(String(code))}`;
}

export function automaticPdfFilename(code, type) {
  const safeCode = String(code || "PPWR").replace(/[^\p{L}\p{N}._-]+/gu, "-");
  return `${type === "teknik-dosya" ? "AK_Teknik_Bilgi" : "AK_AB_Uygunluk"}_${safeCode}.pdf`;
}
