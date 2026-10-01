import { notFound } from "next/navigation";
import { getPublicRecordByCode } from "@/lib/db";
import Article5Viewer from "@/components/Article5Viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Art.5 PPWR Uygunluk Beyanı | Açılım Kutu" };

export default async function DocumentPreview({ params }) {
  const { kod, tur } = await params;
  if (tur !== "art-5-uygunluk-beyani") notFound();
  const record = await getPublicRecordByCode(kod);
  if (!record?.article5_url) notFound();
  return <Article5Viewer code={record.public_code} legacyDoc={/\.doc$/i.test(record.article5_filename || "")} />;
}
