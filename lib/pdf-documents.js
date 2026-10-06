import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFString, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { COMPANY } from "./company.js";
import { recordUrl } from "./document-settings.js";

// Both documents use the same saved record. Optional stamp/signature artwork is
// loaded only from the record's admin-managed Blob URLs. Text remains selectable
// and fonts are embedded.
const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 36;
const INNER = WIDTH - 2 * MARGIN;
const BOTTOM = 783;
const C = {
  ink: rgb(0.09, 0.14, 0.17), muted: rgb(0.35, 0.40, 0.46),
  brand: rgb(13 / 255, 181 / 255, 209 / 255), teal: rgb(0, 0.55, 0.65),
  light: rgb(0.91, 0.97, 0.985), line: rgb(0.77, 0.84, 0.88),
  white: rgb(1, 1, 1), red: rgb(0.83, 0.15, 0.1),
};
let fontFiles;
function fonts() {
  fontFiles ||= Promise.all([
    readFile(path.join(process.cwd(), "assets/pdf/NimbusSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "assets/pdf/NimbusSans-Bold.ttf")),
  ]).catch((error) => { fontFiles = null; throw error; });
  return fontFiles;
}

function text(value, fallback = "-") {
  const result = String(value ?? "").normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u2011\u2013\u2014]/g, "-").trim();
  return result || fallback;
}
function withUnit(value, unit) {
  const result = text(value);
  return result === "-" || result.toLowerCase().endsWith(unit.toLowerCase()) ? result : `${result} ${unit}`;
}
function packageClass(value) {
  return !value || value === "Yedek Parça Kutusu" ? "Yedek Parça Kutusu / Spare Parts Box" : text(value);
}
function packageType(value) {
  return ({ Krome: "Krome / Chromo Board", "E Dalga": "E Dalga / E-Flute", "B Dalga": "B Dalga / B-Flute", "EB Dalga": "EB Dalga / EB-Flute" })[value] || text(value);
}
function materialName(value) {
  return text(value).replace("Tutkal", "Tutkal / Adhesive");
}
function percent(value) {
  return text(value).replace(/^%\s*(.+)$/, "$1%");
}

function safeBlobImageSource(url) {
  try {
    const parsed = new URL(String(url || ""));
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "blob.vercel-storage.com" ||
        parsed.hostname.endsWith(".blob.vercel-storage.com"))
    );
  } catch {
    return false;
  }
}

async function embedRecordImage(doc, url) {
  if (!safeBlobImageSource(url)) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (type.includes("png")) return await doc.embedPng(bytes);
    if (type.includes("jpeg") || type.includes("jpg")) return await doc.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

function drawContainedImage(page, image, x, top, maxWidth, maxHeight) {
  if (!image) return;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: x + (maxWidth - width) / 2,
    y: HEIGHT - top - height,
    width,
    height,
  });
}

function wrap(value, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of text(value, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= maxWidth) {
        line = line ? `${line} ${word}` : word;
      } else {
        if (line) lines.push(line);
        line = "";
        // Codes and URLs may be long, unbroken strings. Never clip or truncate.
        for (const character of word) {
          if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) {
            lines.push(line); line = "";
          }
          line += character;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

class Layout {
  constructor(doc, regular, bold, record, type) {
    Object.assign(this, { doc, regular, bold, record, type });
    this.url = recordUrl(record.public_code);
    this.ppwrId = text(record.ppwr_id, `ACL-APB-85-${record.public_code}`);
    this.declarationId = text(record.declaration_id, this.ppwrId.replace(/(^|[-_.])APB(?=([-_.]|$))/i, "$1DOC"));
    this.newPage();
  }
  rectangle(x, top, width, height, fill = C.white, border = C.line) {
    this.page.drawRectangle({ x, y: HEIGHT - top - height, width, height, color: fill, borderColor: border, borderWidth: 0.45 });
  }
  measure(value, width, size = 8, bold = false, leading = size * 1.25) {
    return wrap(value, bold ? this.bold : this.regular, size, width).length * leading;
  }
  write(value, x, top, width, { size = 8, bold = false, color = C.ink, leading = size * 1.25, align = "left", link } = {}) {
    const font = bold ? this.bold : this.regular;
    const lines = wrap(value, font, size, width);
    lines.forEach((line, i) => {
      const lineWidth = font.widthOfTextAtSize(line, size);
      const offset = align === "center" ? (width - lineWidth) / 2 : align === "right" ? width - lineWidth : 0;
      const y = HEIGHT - top - size - i * leading;
      this.page.drawText(line, { x: x + offset, y, font, size, color });
      if (link && line) this.addLink(x + offset, top + i * leading, lineWidth, leading, link);
    });
    return lines.length * leading;
  }
  mixedLines(parts, width, size = 7.5) {
    const lines = [[]];
    let lineWidth = 0;
    for (const part of parts) {
      const font = part.bold ? this.bold : this.regular;
      const words = text(part.value, "").split(/\s+/).filter(Boolean);
      for (const word of words) {
        const token = `${lineWidth ? " " : ""}${word}`;
        const tokenWidth = font.widthOfTextAtSize(token, size);
        if (lineWidth && lineWidth + tokenWidth > width) {
          lines.push([]);
          lineWidth = 0;
        }
        const actual = `${lineWidth ? " " : ""}${word}`;
        lines[lines.length - 1].push({ value: actual, font });
        lineWidth += font.widthOfTextAtSize(actual, size);
      }
    }
    return lines;
  }
  measureMixed(parts, width, size = 7.5, leading = size * 1.25) {
    return this.mixedLines(parts, width, size).length * leading;
  }
  writeMixed(parts, x, top, width, { size = 7.5, color = C.ink, leading = size * 1.25 } = {}) {
    const lines = this.mixedLines(parts, width, size);
    lines.forEach((segments, i) => {
      let cursor = x;
      const y = HEIGHT - top - size - i * leading;
      for (const segment of segments) {
        this.page.drawText(segment.value, { x: cursor, y, font: segment.font, size, color });
        cursor += segment.font.widthOfTextAtSize(segment.value, size);
      }
    });
    return lines.length * leading;
  }
  addLink(x, top, width, height, url) {
    const annotation = this.doc.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [x, HEIGHT - top - height, x + width, HEIGHT - top],
      Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    this.page.node.addAnnot(this.doc.context.register(annotation));
  }
  newPage() {
    this.page = this.doc.addPage([WIDTH, HEIGHT]);
    this.rectangle(MARGIN, 34, INNER, 41, C.ink, C.ink);
    this.write("AÇILIM KUTU", MARGIN + 9, 41, 190, { size: 13.5, bold: true, color: C.white });
    this.write("PPWR KAYIT SİSTEMİ / PPWR RECORD SYSTEM", MARGIN + 9, 59, 310, { size: 6.8, bold: true, color: rgb(0.47, 0.85, 0.91) });
    this.write(this.type === "teknik-dosya" ? this.ppwrId : this.declarationId, MARGIN + INNER - 200, 46, 191, { size: 7, bold: true, color: C.white, align: "right" });
    const technical = this.type === "teknik-dosya";
    this.y = 85;
    this.y += this.write(technical ? "PPWR Ambalaj Kimlik ve Teknik Bilgi Belgesi" : "AB Uygunluk Beyanı", MARGIN, this.y, INNER, { size: technical ? 15.3 : 17, bold: true, align: "center" });
    this.y += this.write(technical ? "PPWR Packaging Identification & Technical Information Document" : "EU Declaration of Conformity", MARGIN, this.y, INNER, { size: 10.2, bold: true, color: C.teal, align: "center" });
    this.y += 4;
    this.y += this.write(technical ? "Regulation (EU) 2025/40 - Article 16, Article 38 and Annex VII supporting record" : "Regulation (EU) 2025/40 on packaging and packaging waste - Article 39 / Annex VIII", MARGIN, this.y, INNER, { size: 6.7, color: C.muted, align: "center" });
    this.y += 8;
  }
  ensure(height) {
    if (this.y + height > BOTTOM) this.newPage();
  }
  section(title, contentHeight = 0) {
    this.ensure(23 + Math.min(contentHeight, 500));
    this.rectangle(MARGIN, this.y, INNER, 21, C.light);
    this.write(title, MARGIN + 6, this.y + 5, INNER - 12, { size: 8.6, bold: true, color: C.teal });
    this.y += 21;
  }
  cells(items, columns = 4) {
    const width = INNER / columns;
    for (let i = 0; i < items.length; i += columns) {
      const row = items.slice(i, i + columns);
      const height = Math.max(35, ...row.map(([label, value]) => 12 + this.measure(label, width - 10, 6.3, true) + this.measure(value, width - 10, 8, true)));
      this.ensure(height);
      row.forEach(([label, value], col) => {
        const x = MARGIN + col * width;
        this.rectangle(x, this.y, width, height);
        const labelHeight = this.write(label, x + 5, this.y + 5, width - 10, { size: 6.3, bold: true, color: C.muted });
        this.write(value, x + 5, this.y + 7 + labelHeight, width - 10, { size: 8, bold: true });
      });
      this.y += height;
    }
    this.y += 8;
  }
  paragraphs(values, { size = 7.6, gap = 4, color = C.ink } = {}) {
    for (const value of values) {
      const lines = wrap(value, this.regular, size, INNER - 12);
      for (const line of lines) {
        this.ensure(size * 1.3);
        this.write(line, MARGIN + 6, this.y, INNER - 12, { size, color });
        this.y += size * 1.3;
      }
      this.y += gap;
    }
  }
  finish() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      this.page = page;
      this.write("Açılım Kutu PPWR Kayıt Sistemi / PPWR Record System", MARGIN, 806, INNER, { size: 6.2, color: C.muted, align: "center" });
      this.write(this.url, MARGIN, 816, INNER, { size: 6.2, bold: true, color: C.teal, align: "center", link: this.url });
      if (pages.length > 1) this.write(`${index + 1} / ${pages.length}`, WIDTH - MARGIN - 30, 802, 30, { size: 6, color: C.muted, align: "right" });
    });
  }
}

function technicalDocument(l, r) {
  l.cells([
    ["PPWR ID", l.ppwrId], ["Kayıt Kodu / Record Code", text(r.public_code)],
    ["Beyan ID / Declaration ID", l.declarationId], ["Son İnceleme / Last Review", text(r.review_date)],
  ]);
  l.section("Üretici ve İzlenebilirlik / Manufacturer & Traceability", 100);
  const left = [
    ["Ambalaj Üreticisi / Packaging Manufacturer", COMPANY.name],
    ["Adres / Address", COMPANY.address],
    ["İletişim / Contact", `${COMPANY.email} | ${COMPANY.phone}`],
    ["Web", "www.acilimkutu.com"],
  ];
  const right = [
    ["Müşteri / Customer", text(r.customer)], ["Ürün Tanımı / Product Description", text(r.product_name)],
    ["Açılım İş Kodu / Job Code", text(r.job_code)], ["Sistem Kodu / System Code", text(r.system_code)],
  ];
  const colWidth = INNER / 2;
  const mixed = (label, value) => [
    { value: label, bold: true },
    { value, bold: false },
  ];
  const heights = [left, right].map((pairs) =>
    pairs.reduce((sum, [label, value]) => sum + l.measureMixed(mixed(label, value), colWidth - 14, 7.5) + 3, 14)
  );
  const height = Math.max(...heights);
  l.ensure(height);
  [left, right].forEach((pairs, col) => {
    const x = MARGIN + col * colWidth;
    l.rectangle(x, l.y, colWidth, height);
    let top = l.y + 7;
    for (const [label, value] of pairs) {
      top += l.writeMixed(mixed(label, value), x + 7, top, colWidth - 14, { size: 7.5 }) + 3;
    }
  });
  l.y += height + 8;
  l.section("Ambalaj Teknik Özeti / Packaging Technical Summary", 90);
  l.cells([
    ["Ambalaj Sınıfı / Packaging Class", packageClass(r.package_class)],
    ["Ambalaj Tipi / Packaging Type", packageType(r.package_type)],
    ["Geri Dönüşüm Sınıfı / Recycling Class", text(r.usage_cycle).replace(/^PAP\s*/i, "PAP ")],
    ["Ölçüler / Dimensions", withUnit(r.dimensions, "mm")],
    ["Net Alan / Net Area", withUnit(text(r.net_area).replace(/m2$/i, "m²"), "m²")],
    ["Toplam Ağırlık / Total Weight", withUnit(r.total_weight, "g")],
    ["Renk Sayısı / Color Count", text(r.color_count)],
    ["Üretim Tesisi / Production Facility", text(r.production_facility)],
  ]);
  const materials = Array.isArray(r.materials) ? r.materials : [];
  l.section("Malzeme Bileşimi / Material Composition", (materials.length + 2) * 21);
  const widths = [INNER * 0.58, INNER * 0.21, INNER * 0.21];
  const row = (values, { header = false, total = false } = {}) => {
    const size = header ? 7.2 : 7.6;
    const bold = header || total;
    const rowHeight = Math.max(17.5, ...values.map((v, i) => l.measure(v, widths[i] - 10, size, bold) + 7));
    l.ensure(rowHeight);
    let x = MARGIN;
    values.forEach((value, i) => {
      l.rectangle(x, l.y, widths[i], rowHeight, header ? C.ink : total ? C.light : C.white);
      l.write(value, x + 5, l.y + 5, widths[i] - 10, { size, bold, color: header ? C.white : total ? C.teal : C.ink });
      x += widths[i];
    });
    l.y += rowHeight;
  };
  row(["Malzeme / Material", "Ağırlık / Weight", "Oran / Ratio"], { header: true });
  for (const material of materials) row([materialName(material.name), text(material.weight), percent(material.ratio)]);
  row(["Toplam / Total", withUnit(r.total_weight, "g"), materials.length ? "100%" : "-"], { total: true });
  l.y += 8;
  l.section("PPWR Teknik Dosya Bağlantısı / PPWR Technical File Linkage", 82);
  l.y += 4;
  l.paragraphs([
    "Bu belge, ambalajın kimliği ve temel teknik verilerini özetler ve PPWR Ek VII kapsamındaki kontrollü teknik dosyayı destekler. / This document summarises packaging identity and core technical data and supports the controlled technical documentation under PPWR Annex VII.",
    "Ek VII teknik dosyasında, uygulanabilir olduğu ölçüde; genel tanım ve kullanım amacı, tasarım/üretim çizimleri, bileşen malzemeleri, kullanılan standart veya teknik şartnameler, ilgili değerlendirmelerin açıklaması, uygunsuzluk risk analizi ve test raporları ayrıca muhafaza edilmelidir. / The Annex VII technical file should additionally retain, as applicable, the general description and intended use, design/manufacturing drawings, component materials, standards or technical specifications used, assessment descriptions, non-conformity risk analysis and test reports.",
  ], { size: 6.9 });
  l.y += 4;
  l.ensure(109);
  l.rectangle(MARGIN, l.y, INNER, 94);
  l.write("Dijital Kayıt / Digital Record", MARGIN + 6, l.y + 7, INNER - 116, { size: 7, bold: true, color: C.muted });
  const urlHeight = l.write(l.url, MARGIN + 6, l.y + 19, INNER - 116, { size: 8.1, bold: true, color: C.teal, link: l.url });
  l.write("Güncel kamu kaydı ve kontrollü belge erişimi / Current public record and controlled document access", MARGIN + 6, l.y + 23 + urlHeight, INNER - 116, { size: 6.6, color: C.muted });
  const qr = QRCode.create(l.url, { errorCorrectionLevel: "M" });
  const quiet = 4;
  const qrSize = 86;
  const unit = qrSize / (qr.modules.size + quiet * 2);
  const qrX = WIDTH - MARGIN - qrSize - 4;
  const qrTop = l.y + 4;
  for (let y = 0; y < qr.modules.size; y++) {
    for (let x = 0; x < qr.modules.size; x++) {
      if (qr.modules.get(y, x)) l.page.drawRectangle({ x: qrX + (x + quiet) * unit, y: HEIGHT - qrTop - (y + quiet + 1) * unit, width: unit, height: unit, color: rgb(0, 0, 0) });
    }
  }
  l.addLink(qrX, qrTop, qrSize, qrSize, l.url);
  l.y += 99;
  l.write("Not / Note: Bu özet, AB Uygunluk Beyanı yerine geçmez. / This summary does not replace the EU Declaration of Conformity.", MARGIN, l.y, INNER, { size: 6.4, bold: true, color: C.red, align: "center" });
}

function declarationDocument(l, r, artwork = {}) {
  l.y += l.write(`Beyan No / Declaration No: ${l.declarationId}`, MARGIN, l.y, INNER, { size: 8, bold: true, color: C.muted, align: "center" }) + 5;
  const sections = [
    ["Ambalajın benzersiz kimliği / Unique identification of the packaging", `${l.ppwrId} | Kamu Kayıt Kodu / Public Record Code: ${text(r.public_code)}`],
    ["Üreticinin adı ve adresi / Name and address of the manufacturer", `${COMPANY.name}\n${COMPANY.address}\n${COMPANY.email} | ${COMPANY.phone} | www.acilimkutu.com`],
    ["Üreticinin sorumluluğu / Manufacturer responsibility", "Bu uygunluk beyanı üreticinin münhasır sorumluluğu altında düzenlenmiştir. / This declaration of conformity is issued under the sole responsibility of the manufacturer."],
    ["Beyanın konusu - ambalajın izlenebilir tanımı / Object of the declaration - traceable packaging description", `${text(r.product_name)} - ${packageClass(r.package_class)}; ${packageType(r.package_type)}; Ölçüler / Dimensions: ${withUnit(r.dimensions, "mm")}; Net alan / Net area: ${withUnit(r.net_area, "m²")}; Toplam ağırlık / Total weight: ${withUnit(r.total_weight, "g")}; Sistem kodu / System code: ${text(r.system_code)}; Müşteri / Customer: ${text(r.customer)}`],
    ["Uygulanabilir Birlik mevzuatına uygunluk / Conformity with relevant Union harmonisation legislation", "Beyan konusu ambalajın, uygulanabilir olduğu ölçüde Regulation (EU) 2025/40 kapsamında veya bu Tüzüğe dayanılarak belirlenen Articles 5-12 gerekliliklerine uygunluğu, Article 38 ve Annex VII kapsamındaki uygunluk değerlendirmesi ile gösterilmiştir. / The packaging covered by this declaration has been assessed under Article 38 and Annex VII with respect to the applicable requirements laid down in or pursuant to Articles 5-12 of Regulation (EU) 2025/40."],
    ["Kullanılan standartlar, ortak spesifikasyonlar veya diğer teknik şartnameler / Standards, common specifications or other technical specifications used", `Kontrollü teknik dosya / Controlled technical file: ${l.ppwrId}; ambalaj malzeme bileşimi ve ağırlık hesaplama kaydı; üretim/kalıp çizimleri ve müşteri teknik şartları (uygulanabildiği ölçüde). Uygulanan harmonize standartlar veya ortak spesifikasyonlar varsa kontrollü teknik dosyada güncel referanslarıyla listelenir. / Controlled technical file: ${l.ppwrId}; packaging material composition and weight calculation record; manufacturing/dieline drawings and customer technical specifications where applicable. Any harmonised standards or common specifications actually applied are listed with current references in the controlled technical file.`],
    ["Onaylanmış kuruluş / Notified body", "Uygulanamaz / Not applicable for the PPWR Annex VII Module A internal production control procedure, unless another applicable Union act requires notified-body involvement."],
    ["İlave bilgi / Additional information", `Dijital kayıt / Digital record: ${l.url}. Son inceleme / Last review: ${text(r.review_date)}. Bu beyan ve dayanak teknik dokümantasyon değişiklikler halinde güncel tutulmalıdır. Saklama süreleri Article 15(3) uyarınca ambalajın niteliğine göre uygulanır. / This declaration and its supporting technical documentation must be kept up to date when changes occur. Retention periods apply in accordance with Article 15(3), depending on the packaging type.`],
  ];
  for (const [index, [title, body]] of sections.entries()) {
    const width = INNER - 34;
    const headingHeight = l.measure(title, width, 7.5, true);
    const bodyHeight = l.measure(body, width, 7.0);
    const height = headingHeight + bodyHeight + 12;
    l.ensure(height);
    l.rectangle(MARGIN, l.y, 22, height, C.brand, C.brand);
    l.write(String(index + 1), MARGIN + 3, l.y + 7, 16, { size: 8.5, bold: true, color: C.white, align: "center" });
    l.rectangle(MARGIN + 22, l.y, INNER - 22, height);
    l.write(title, MARGIN + 28, l.y + 5, width, { size: 7.5, bold: true, color: C.teal });
    l.write(body, MARGIN + 28, l.y + 8 + headingHeight, width, { size: 7.0 });
    l.y += height;
  }
  l.section("İmza / Signature", 107);
  const signatureRows = [
    ["Adına imzalanmıştır / Signed for and on behalf of", COMPANY.name],
    ["Yer ve düzenleme tarihi / Place and date of issue", `Menderes / İzmir, ${text(r.document_issue_date)}`],
    ["Ad, görev ve imza / Name, function and signature", `${text(r.signatory_name)}\n${text(r.signatory_title)}`],
  ];
  signatureRows.forEach(([label, value], i) => {
    const leftWidth = INNER / 2;
    const hasArtwork = i === 2 && (artwork.stamp || artwork.signature);
    const height = Math.max(i === 2 ? (hasArtwork ? 92 : 62) : 23, l.measure(value, leftWidth - 12, 7.5) + 10, l.measure(label, leftWidth - 12, 6.4, true) + 10);
    l.ensure(height);
    const rowTop = l.y;
    l.rectangle(MARGIN, rowTop, leftWidth, height);
    l.rectangle(MARGIN + leftWidth, rowTop, leftWidth, height);
    l.write(label, MARGIN + 6, rowTop + 6, leftWidth - 12, { size: 6.4, bold: true, color: C.muted });
    const textHeight = l.write(value, MARGIN + leftWidth + 6, rowTop + 6, leftWidth - 12, { size: 7.5 });
    if (hasArtwork) {
      const artX = MARGIN + leftWidth + 12;
      const artWidth = leftWidth - 24;
      const artTop = rowTop + Math.max(25, 9 + textHeight);
      const artHeight = Math.max(36, height - (artTop - rowTop) - 5);
      if (artwork.stamp && artwork.signature) {
        drawContainedImage(l.page, artwork.signature, artX + artWidth * 0.16, artTop, artWidth * 0.68, Math.min(32, artHeight * 0.48));
        drawContainedImage(l.page, artwork.stamp, artX + artWidth * 0.08, artTop + Math.min(21, artHeight * 0.25), artWidth * 0.84, Math.min(48, artHeight * 0.72));
      } else {
        drawContainedImage(l.page, artwork.signature || artwork.stamp, artX, artTop, artWidth, artHeight);
      }
    }
    l.y += height;
  });
  l.y += 10;
  l.ensure(25);
  l.y += l.write("Bu beyan, yetkili kişi tarafından imzalandığında yürürlüğe girer. / This declaration takes effect when signed by an authorised person.", MARGIN, l.y, INNER, { size: 6.3, bold: true, color: C.red, align: "center" }) + 3;
  l.write("Hukuki dayanak / Legal basis: Regulation (EU) 2025/40, Articles 15, 38, 39; Annex VII (Module A) and Annex VIII.", MARGIN, l.y, INNER, { size: 6.2, color: C.muted, align: "center" });
}

export async function generateRecordPdf(record, type) {
  if (!["teknik-dosya", "uygunluk-beyani"].includes(type)) throw new Error("Geçersiz PDF türü.");
  if (!record?.public_code) throw new Error("Kayıt kodu gerekli.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await fonts();
  const [regular, bold] = await Promise.all([doc.embedFont(regularBytes, { subset: true }), doc.embedFont(boldBytes, { subset: true })]);
  doc.setTitle(`${type === "teknik-dosya" ? "PPWR Ambalaj Kimlik ve Teknik Bilgi Belgesi" : "AB Uygunluk Beyanı"} - ${record.public_code}`);
  doc.setAuthor(COMPANY.name);
  doc.setCreator("Açılım Kutu PPWR Kayıt Sistemi");
  doc.setProducer("Açılım Kutu");
  doc.setSubject(recordUrl(record.public_code));
  const l = new Layout(doc, regular, bold, record, type);
  if (type === "teknik-dosya") {
    technicalDocument(l, record);
  } else {
    const [stamp, signature] = await Promise.all([
      embedRecordImage(doc, record.stamp_image_url),
      embedRecordImage(doc, record.signature_image_url),
    ]);
    declarationDocument(l, record, { stamp, signature });
  }
  l.finish();
  return doc.save();
}
