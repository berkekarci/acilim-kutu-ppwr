import { inflateRawSync } from "node:zlib";

const ARTICLE5_ID_PATTERN = /ACL-APB-85-[A-Za-z0-9._-]+/;
const ARTICLE5_DATE_PATTERN = /\b\d{2}\.\d{2}\.\d{4}\b/;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parseZip(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) throw new Error("Art.5 DOCX şablonu okunamadı.");

    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const modTime = buffer.readUInt16LE(offset + 10);
    const modDate = buffer.readUInt16LE(offset + 12);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    if (flags & 0x08) throw new Error("Art.5 DOCX şablonunun ZIP yapısı desteklenmiyor.");

    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = inflateRawSync(compressed);
    else throw new Error("Art.5 DOCX şablonunda desteklenmeyen sıkıştırma yöntemi var.");

    if (data.length !== uncompressedSize) throw new Error("Art.5 DOCX şablonu eksik veya bozuk.");
    entries.push({ name, data, modTime, modDate });
    offset = dataStart + compressedSize;
  }

  if (!entries.length) throw new Error("Art.5 DOCX şablonunda dosya bulunamadı.");
  return entries;
}

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(entry.modTime || 0, 10);
    local.writeUInt16LE(entry.modDate || 0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(entry.modTime || 0, 12);
    central.writeUInt16LE(entry.modDate || 0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDirectory, end]);
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replaceAcrossTextNodes(paragraphXml, pattern, replacement) {
  const textNodePattern = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g;
  const nodes = [];
  let match;

  while ((match = textNodePattern.exec(paragraphXml))) {
    nodes.push({ attrs: match[1], text: match[2] });
  }
  if (!nodes.length) return { xml: paragraphXml, changed: false };

  const combined = nodes.map((node) => node.text).join("");
  const found = combined.match(pattern);
  if (!found || found.index == null) return { xml: paragraphXml, changed: false };

  const start = found.index;
  const end = start + found[0].length;
  const nextTexts = nodes.map((node) => node.text);
  let cursor = 0;
  let firstTouched = -1;
  let lastTouched = -1;

  for (let i = 0; i < nodes.length; i++) {
    const nodeStart = cursor;
    const nodeEnd = cursor + nodes[i].text.length;
    if (nodeEnd > start && nodeStart < end) {
      if (firstTouched < 0) firstTouched = i;
      lastTouched = i;
    }
    cursor = nodeEnd;
  }
  if (firstTouched < 0) return { xml: paragraphXml, changed: false };

  let firstStart = 0;
  for (let i = 0; i < firstTouched; i++) firstStart += nodes[i].text.length;
  let lastStart = 0;
  for (let i = 0; i < lastTouched; i++) lastStart += nodes[i].text.length;

  const before = nodes[firstTouched].text.slice(0, start - firstStart);
  const after = nodes[lastTouched].text.slice(end - lastStart);
  nextTexts[firstTouched] = before + xmlEscape(replacement) + (firstTouched === lastTouched ? after : "");
  for (let i = firstTouched + 1; i < lastTouched; i++) nextTexts[i] = "";
  if (lastTouched !== firstTouched) nextTexts[lastTouched] = after;

  let index = 0;
  const xml = paragraphXml.replace(textNodePattern, (_whole, attrs) => {
    const next = nextTexts[index++];
    return `<w:t${attrs}>${next}</w:t>`;
  });
  return { xml, changed: true };
}

function patchArticle5Xml(xml, ppwrId, issueDate) {
  let idCount = 0;
  let dateCount = 0;

  const patched = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    let current = paragraph;
    const idResult = replaceAcrossTextNodes(current, ARTICLE5_ID_PATTERN, ppwrId);
    if (idResult.changed) {
      current = idResult.xml;
      idCount++;
    }

    if (current.includes("Pınar Çoksezenler")) {
      const dateResult = replaceAcrossTextNodes(current, ARTICLE5_DATE_PATTERN, issueDate);
      if (dateResult.changed) {
        current = dateResult.xml;
        dateCount++;
      }
    }
    return current;
  });

  if (idCount !== 2) throw new Error(`Art.5 şablonunda beklenen 2 PPWR ID alanı bulunamadı (bulunan: ${idCount}).`);
  if (dateCount !== 1) throw new Error("Art.5 şablonunda tarih alanı bulunamadı.");
  return patched;
}

function safeBlobSource(url) {
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

export async function generateArticle5Docx(record, templateRecord) {
  const ppwrId = String(record?.ppwr_id || `ACL-APB-85-${record?.public_code || ""}`).trim();
  const issueDate = String(record?.document_issue_date || record?.review_date || "").trim();
  const templateUrl = templateRecord?.article5_url;

  if (!ppwrId) throw new Error("Art.5 için PPWR ID gerekli.");
  if (!issueDate) throw new Error("Art.5 için beyan düzenleme tarihi gerekli.");
  if (!templateUrl || !safeBlobSource(templateUrl)) {
    throw new Error("Art.5 otomatik Word şablonu bulunamadı. Önce bir DOCX şablonu yüklenmelidir.");
  }

  const response = await fetch(templateUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Art.5 Word şablonu alınamadı.");

  const source = Buffer.from(await response.arrayBuffer());
  if (source.length < 4 || source.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("Art.5 şablonu geçerli bir DOCX dosyası değil.");
  }

  const entries = parseZip(source);
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("Art.5 Word şablonunda document.xml bulunamadı.");

  const xml = document.data.toString("utf8");
  document.data = Buffer.from(patchArticle5Xml(xml, ppwrId, issueDate), "utf8");
  return buildZip(entries);
}
