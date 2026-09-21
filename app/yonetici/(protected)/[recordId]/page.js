import { notFound } from "next/navigation";
import Link from "next/link";
import RevisionEditor from "@/components/RevisionEditor";
import { getRecordDetail } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecordDetailPage({ params, searchParams }) {
  const { recordId } = await params;
  const qs = await searchParams;
  const detail = await getRecordDetail(recordId);
  if (!detail) notFound();

  const selectedRevisionId = qs?.rev || detail.revisions?.[0]?.id;
  const revision = detail.revisions.find((r) => String(r.id) === String(selectedRevisionId)) || detail.revisions?.[0];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <div className="admin-kicker">PPWR KAYDI</div>
          <h1>{detail.public_code}</h1>
          <p>{detail.product_name || "Ürün tanımı girilmedi"}</p>
        </div>
        <Link href={`/` + encodeURIComponent(detail.public_code)} target="_blank" className="admin-secondary">Kamu sayfasını aç</Link>
      </div>

      {detail.revisions.length > 0 && (
        <div className="revision-tabs">
          {detail.revisions.map((r) => (
            <Link key={r.id} href={`/yonetici/${recordId}?rev=${r.id}`} className={revision?.id === r.id ? "active" : ""}>
              {r.revision_no}<small>{r.status}</small>
            </Link>
          ))}
        </div>
      )}

      <RevisionEditor record={detail} revision={revision} />
    </div>
  );
}
