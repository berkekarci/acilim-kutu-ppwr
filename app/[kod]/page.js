import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getPublicRecordByCode } from "@/lib/db";
import PublicRecord from "@/components/PublicRecord";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { kod } = await params;
  return { title: `${decodeURIComponent(kod)} · Açılım Kutu PPWR` };
}

export default async function PublicRecordPage({ params }) {
  const { kod } = await params;
  const code = decodeURIComponent(kod);
  const record = await getPublicRecordByCode(code);
  if (!record) notFound();
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://ppwr.acilimkutu.com").replace(/\/$/, "");
  const url = `${base}/${encodeURIComponent(record.public_code)}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 284 });
  return <PublicRecord record={record} qrDataUrl={qrDataUrl} />;
}
