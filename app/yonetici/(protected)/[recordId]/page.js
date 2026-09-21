import { notFound } from "next/navigation";
import { getCurrentRecordData, getRecordById } from "@/lib/db";
import RecordEditor from "@/components/RecordEditor";
import DeleteRecordButton from "@/components/DeleteRecordButton";
import { deleteRecordAction, saveRecordAction } from "../actions";

export default async function RecordPage({ params, searchParams }) {
  const { recordId } = await params;
  const sp = await searchParams;
  const record = await getRecordById(recordId);
  if (!record) notFound();
  const current = await getCurrentRecordData(recordId);
  if (!current) notFound();
  const publicUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "https://ppwr.acilimkutu.com").replace(/\/$/, "")}/${encodeURIComponent(record.code)}`;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div><div className="admin-kicker">KAMU KODU</div><h1>{record.code}</h1><p>{publicUrl}</p></div>
        <div className="admin-header-actions">
          <a className="admin-secondary" href={publicUrl} target="_blank" rel="noreferrer">Kamu Sayfasını Aç</a>
          <DeleteRecordButton recordId={recordId} code={record.code} action={deleteRecordAction} />
        </div>
      </div>

      {sp?.kaydedildi && <div className="successbox">Değişiklikler kaydedildi ve kamu sayfasında doğrudan yayınlandı.</div>}
      {sp?.hata === "silme-onay" && <div className="errorbox">PPWR kaydı silinemedi: silme onayı alınamadı.</div>}
      <RecordEditor recordData={current} recordId={recordId} action={saveRecordAction} />
    </div>
  );
}
