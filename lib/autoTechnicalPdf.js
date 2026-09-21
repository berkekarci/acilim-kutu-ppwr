import pdfMakeImport from "pdfmake/build/pdfmake";
import pdfFontsImport from "pdfmake/build/vfs_fonts";
import { COMPANY } from "@/lib/company";

const pdfMake = pdfMakeImport?.default || pdfMakeImport;
const pdfFonts = pdfFontsImport?.default || pdfFontsImport;
pdfMake.vfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;

const BRAND = "#0db5d1";
const BRAND_DARK = "#087f94";
const INK = "#18212a";
const MUTED = "#64707c";
const LINE = "#dce5e8";
const SOFT = "#f5fafb";
const DARK = "#17242b";

function value(v, fallback = "—") {
  const text = String(v ?? "").trim();
  return text || fallback;
}

function dimensions(valueText) {
  const parts = String(valueText || "")
    .toLowerCase()
    .replace(/mm/g, "")
    .replace(/,/g, ".")
    .split(/[x×*]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length === 3 ? parts : ["", "", ""];
}

function packageTypeLabel(v) {
  const type = String(v || "").trim();
  if (type === "E Dalga") return "E Dalga / E-Flute";
  if (type === "B Dalga") return "B Dalga / B-Flute";
  if (type === "EB Dalga") return "EB Dalga / EB-Flute";
  return value(type);
}

function packageClassLabel(v) {
  const text = String(v || "").trim();
  if (!text || text === "Yedek Parça Kutusu") return "Yedek Parça Kutusu / Spare Parts Box";
  return text;
}

function materialLabel(v) {
  return String(v || "")
    .replace("Krome Karton", "Krome Karton / Chromo Board")
    .replace("Tutkal", "Tutkal / Adhesive");
}

function cellLabel(text) {
  return { text, color: MUTED, fontSize: 7.2, bold: true, margin: [0, 0, 0, 2] };
}

function cellValue(text) {
  return { text: value(text), color: INK, fontSize: 9, bold: true };
}

function dataCell(label, val) {
  return {
    stack: [cellLabel(label), cellValue(val)],
    fillColor: SOFT,
    margin: [7, 6, 7, 6],
  };
}

function materialRows(materials = []) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return [[
      { text: "Malzeme bileşimi girilmemiş. / Material composition not provided.", colSpan: 3, color: MUTED, italics: true, margin: [5, 6] },
      {}, {}
    ]];
  }
  return materials.map((m) => [
    { text: materialLabel(m?.name), margin: [5, 5], fontSize: 8.2 },
    { text: value(m?.weight), margin: [5, 5], fontSize: 8.2 },
    { text: value(m?.ratio), margin: [5, 5], fontSize: 8.2 },
  ]);
}

async function fetchImageDataUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (type !== "image/png" && type !== "image/jpeg" && type !== "image/jpg") return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const mime = type === "image/jpg" ? "image/jpeg" : type;
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function createPackagingTechnicalPdf(record, publicUrl) {
  const [widthMm, lengthMm, heightMm] = dimensions(record.dimensions);
  const productImage = await fetchImageDataUrl(record.product_image_url);
  const mats = Array.isArray(record.materials) ? record.materials : [];

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [28, 28, 28, 24],
    defaultStyle: {
      font: "Roboto",
      fontSize: 8.4,
      color: INK,
      lineHeight: 1.12,
    },
    info: {
      title: `PPWR Ambalaj Kimlik ve Teknik Bilgi - ${record.public_code}`,
      author: COMPANY.name,
      subject: "PPWR Packaging Identification and Technical Information",
      keywords: "PPWR, packaging, traceability, technical information",
    },
    content: [
      {
        table: {
          widths: ["*"],
          body: [[{
            fillColor: DARK,
            margin: [14, 12, 14, 12],
            stack: [
              { text: "AÇILIM KUTU", color: "#ffffff", fontSize: 16, bold: true },
              { text: "PPWR AMBALAJ KİMLİK VE TEKNİK BİLGİ BELGESİ", color: "#ffffff", fontSize: 12.5, bold: true, margin: [0, 4, 0, 1] },
              { text: "PPWR PACKAGING IDENTIFICATION & TECHNICAL INFORMATION", color: "#8ce8f6", fontSize: 8.2, bold: true },
            ],
          }]]
        },
        layout: "noBorders",
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Regulation (EU) 2025/40 - Packaging and Packaging Waste (PPWR)", color: BRAND_DARK, fontSize: 8.2, bold: true },
              { text: "Bu belge, sistemdeki güncel PPWR kayıt verilerinden otomatik oluşturulmuştur. / This document is generated automatically from the current PPWR record data.", color: MUTED, fontSize: 7.2, margin: [0, 3, 0, 0] },
            ],
          },
          {
            width: 84,
            alignment: "right",
            stack: [
              { qr: publicUrl, fit: 62, foreground: DARK, background: "#ffffff", alignment: "right" },
              { text: value(record.public_code), fontSize: 7.5, bold: true, alignment: "right", margin: [0, 3, 0, 0] },
            ],
          },
        ],
        columnGap: 12,
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [[
            dataCell("PPWR ID", record.ppwr_id),
            dataCell("Beyan ID / Declaration ID", record.declaration_id),
            dataCell("Kayıt Kodu / Record Code", record.public_code),
            dataCell("Son İnceleme / Last Review", record.review_date),
          ]],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.7,
          vLineWidth: () => 0.7,
        },
        margin: [0, 0, 0, 10],
      },
      { text: "1. ÜRETİCİ VE İZLENEBİLİRLİK / MANUFACTURER & TRACEABILITY", fontSize: 9.2, bold: true, color: BRAND_DARK, margin: [0, 0, 0, 5] },
      {
        table: {
          widths: ["32%", "68%"],
          body: [
            [{ text: "Ambalaj Üreticisi / Packaging Manufacturer", style: "key" }, { text: COMPANY.name, style: "val" }],
            [{ text: "Adres / Address", style: "key" }, { text: COMPANY.address, style: "val" }],
            [{ text: "İletişim / Contact", style: "key" }, { text: `${COMPANY.email} · ${COMPANY.phone}`, style: "val" }],
            [{ text: "Üretim Tesisi / Production Facility", style: "key" }, { text: value(record.production_facility), style: "val" }],
            [{ text: "Müşteri / Customer", style: "key" }, { text: value(record.customer), style: "val" }],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.55,
          vLineWidth: () => 0.55,
        },
        margin: [0, 0, 0, 10],
      },
      { text: "2. AMBALAJ TANIMI / PACKAGING IDENTIFICATION", fontSize: 9.2, bold: true, color: BRAND_DARK, margin: [0, 0, 0, 5] },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              dataCell("Açılım İş Kodu / Job Code", record.job_code),
              dataCell("Sistem Kodu / System Code", record.system_code),
              dataCell("Renk Sayısı / Color Count", record.color_count),
            ],
            [
              dataCell("Ürün Tanımı / Product Description", record.product_name),
              dataCell("Ambalaj Sınıfı / Packaging Class", packageClassLabel(record.package_class)),
              dataCell("Ambalaj Tipi / Packaging Type", packageTypeLabel(record.package_type)),
            ],
            [
              dataCell("Geri Dönüşüm Sınıfı / Recycling Class", String(record.usage_cycle || "").replace("PAP", "PAP ")),
              dataCell("Net Alan / Net Area", record.net_area),
              dataCell("Toplam Ağırlık / Total Weight", record.total_weight),
            ],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.7,
          vLineWidth: () => 0.7,
        },
        margin: [0, 0, 0, 10],
      },
      { text: "3. BOYUTSAL VE GÖRSEL BİLGİ / DIMENSIONAL & VISUAL INFORMATION", fontSize: 9.2, bold: true, color: BRAND_DARK, margin: [0, 0, 0, 5] },
      {
        columns: [
          {
            width: productImage ? "62%" : "*",
            table: {
              widths: ["*", "*", "*"],
              body: [[
                dataCell("En / Width", widthMm ? `${widthMm} mm` : "—"),
                dataCell("Boy / Length", lengthMm ? `${lengthMm} mm` : "—"),
                dataCell("Yükseklik / Height", heightMm ? `${heightMm} mm` : "—"),
              ]],
            },
            layout: {
              hLineColor: () => LINE,
              vLineColor: () => LINE,
              hLineWidth: () => 0.7,
              vLineWidth: () => 0.7,
            },
          },
          ...(productImage ? [{
            width: "38%",
            margin: [8, 0, 0, 0],
            table: {
              widths: ["*"],
              body: [[{
                image: productImage,
                fit: [155, 82],
                alignment: "center",
                margin: [4, 4, 4, 4],
              }]],
            },
            layout: {
              hLineColor: () => LINE,
              vLineColor: () => LINE,
              hLineWidth: () => 0.7,
              vLineWidth: () => 0.7,
            },
          }] : []),
        ],
        columnGap: 8,
        margin: [0, 0, 0, 10],
      },
      { text: "4. MALZEME BİLEŞİMİ / MATERIAL COMPOSITION", fontSize: 9.2, bold: true, color: BRAND_DARK, margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ["58%", "22%", "20%"],
          body: [
            [
              { text: "Malzeme / Material", style: "th" },
              { text: "Ağırlık / Weight", style: "th" },
              { text: "Oran / Ratio", style: "th" },
            ],
            ...materialRows(mats),
            [
              { text: "Toplam / Total", bold: true, margin: [5, 5] },
              { text: value(record.total_weight), bold: true, margin: [5, 5] },
              { text: "100%", bold: true, margin: [5, 5] },
            ],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.55,
          vLineWidth: () => 0.55,
        },
        margin: [0, 0, 0, 10],
      },
      { text: "5. DİJİTAL KAYIT / DIGITAL RECORD", fontSize: 9.2, bold: true, color: BRAND_DARK, margin: [0, 0, 0, 5] },
      {
        table: {
          widths: ["32%", "68%"],
          body: [
            [{ text: "Kamu PPWR Kaydı / Public PPWR Record", style: "key" }, { text: publicUrl, style: "val" }],
            [{ text: "Belge Durumu / Document Status", style: "key" }, { text: "Güncel kayıt verilerinden otomatik oluşturuldu / Automatically generated from current record data", style: "val" }],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.55,
          vLineWidth: () => 0.55,
        },
      },
      {
        text: "Not / Note: Bu teknik bilgi belgesi sistem kaydının okunabilir çıktısıdır. İmzalı AB Uygunluk Beyanı gereken durumlarda ilgili imzalı beyanın yerine geçmez. / This technical information document is a readable output of the system record and does not replace a signed EU Declaration of Conformity where one is required.",
        color: MUTED,
        fontSize: 6.7,
        margin: [0, 8, 0, 0],
      },
    ],
    styles: {
      key: { color: MUTED, fontSize: 7.4, bold: true, margin: [5, 5] },
      val: { color: INK, fontSize: 8.2, bold: true, margin: [5, 5] },
      th: { color: "#ffffff", fillColor: BRAND_DARK, bold: true, fontSize: 7.5, margin: [5, 5] },
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}`, color: MUTED, fontSize: 6.2, margin: [28, 0, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, color: MUTED, fontSize: 6.2, alignment: "right", margin: [0, 0, 28, 0] },
      ],
    }),
  };

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBuffer((buffer) => resolve(Buffer.from(buffer)));
    } catch (error) {
      reject(error);
    }
  });
}
