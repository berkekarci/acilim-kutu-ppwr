import AdminSidebar from "@/components/AdminSidebar";
import { requireAdmin } from "@/lib/auth";
import { listRecords } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }) {
  await requireAdmin();
  const records = await listRecords();
  return <div className="admin-shell"><AdminSidebar records={records} /><main className="admin-main">{children}</main></div>;
}
