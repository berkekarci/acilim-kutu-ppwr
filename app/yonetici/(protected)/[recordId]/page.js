import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecordById, getRevisions } from "@/lib/db";
import RevisionEditor from "@/components/RevisionEditor";
import DeleteRecordButton from "@/components/DeleteRecordButton";
import { deleteRecordAction, newRevisionAction, publishRevisionAction, saveRevisionAction } from "../actions";

export default async function RecordPage({ params, searchParams }) {
  const { recordId } = await params;
  const sp = await searchParams;
  const record = await getRecordById(recordId);
  if (!record) notFound();
  const revisions = await getRevisions(recordId);
  if (!revisions.length) notFound();

  const selected = revisions.find((revision) => String(revision.id) === String(sp?.rev)) || revisions[0];
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

      {sp?.kaydedildi && <div className="successbox">Revizyon kaydedildi.</div>}
      {sp?.yayinlandi && <div className="successbox">Revizyon yayınlandı. Bu kodun kamu URL'si artık bu revizyonu gösteriyor; önceki yayın arşivlendi.</div>}
      {sp?.hata === "yayin-zorunlu" && <div className="errorbox">Yayın için PPWR ID ve ürün adı zorunludur. PDF belgeleri isteğe bağlıdır.</div>}
      {sp?.hata === "revizyon" && <div className="errorbox">Revizyon etiketi boş/geçersiz. / ? # % karakterleri kullanılamaz.</div>}
      {sp?.hata === "revizyon-tekrar" && <div className="errorbox">Bu revizyon etiketi bu kayıt altında zaten kullanılıyor.</div>}
      {sp?.hata === "silme-onay" && <div className="errorbox">PPWR kaydı silinemedi: silme onayı alınamadı.</div>}

      <div className="revision-tabs">
        {revisions.map((revision) => (
          <Link key={revision.id} href={`/yonetici/${recordId}?rev=${revision.id}`} className={String(revision.id) === String(selected.id) ? "active" : ""}>
            {revision.revision_label}<small>{revision.status === "published" ? "yayında" : revision.status === "archived" ? "arşiv" : "çalışma revizyonu"}</small>
          </Link>
        ))}
      </div>

      <div className="revision-toolbar">
        <form action={newRevisionAction} className="inline-form">
          <input type="hidden" name="record_id" value={recordId} />
          <input type="hidden" name="source_revision_id" value={selected.id} />
          <input name="new_revision_label" placeholder="Rev.01" required />
          <button className="admin-secondary" type="submit">Yeni Revizyon Oluştur</button>
        </form>
        {selected.status !== "published" && selected.status !== "archived" && (
          <form action={publishRevisionAction}>
            <input type="hidden" name="record_id" value={recordId} />
            <input type="hidden" name="revision_id" value={selected.id} />
            <button className="publish-btn" type="submit">Bu Revizyonu Yayınla</button>
          </form>
        )}
      </div>

      <RevisionEditor revision={selected} recordId={recordId} action={saveRevisionAction} />
    </div>
  );
}
