import { requireAuth, hasRole } from "@/lib/server-auth"
import { TenantPrisma } from "@/lib/tenant-guard"
import { ManagerDashboard } from "@/components/manager/ManagerDashboard"

export default async function ManagerPage() {
  const session = await requireAuth()
  
  // Check if user has manager or admin role
  if (!hasRole(["MANAGER", "ADMIN"])) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600">You need manager or admin privileges to access this page.</p>
        </div>
      </div>
    )
  }

  const tenant = new TenantPrisma(session.companyId, session.userId)

  return (
    <div className="container mx-auto py-8">
      <ManagerDashboard tenant={tenant} session={session} />
    </div>
  )
}

