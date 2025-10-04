import { requireAuth } from '@/lib/server-auth';
import { TenantPrisma } from '@/lib/tenant-guard';
import { EmployeeDashboard } from '@/components/employee/EmployeeDashboard';

export default async function EmployeePage() {
  const session = await requireAuth();
  const tenant = new TenantPrisma(session.companyId, session.userId);

  return <EmployeeDashboard tenant={tenant} />;
}
