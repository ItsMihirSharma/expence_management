import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Users, FileText, Settings, History, TrendingUp } from "lucide-react"
import { requireAuth, hasRole } from "@/lib/server-auth"
import { TenantPrisma } from "@/lib/tenant-guard"
import { AdminOverviewTab } from "@/components/admin/AdminOverviewTab"
import { AdminProjectsTab } from "@/components/admin/AdminProjectsTab"
import { AdminUsersTab } from "@/components/admin/AdminUsersTab"
import { AdminPoliciesTab } from "@/components/admin/AdminPoliciesTab"
import { AdminHistoryTab } from "@/components/admin/AdminHistoryTab"

async function AdminDashboard() {
  // Require admin role
  const session = await requireAuth()
  await hasRole("ADMIN") // Double-check admin role

  // Create tenant-scoped database access
  const tenant = new TenantPrisma(session.companyId, session.userId)

  // Get company info
  const company = await tenant.getCompany()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
              Universal Expense Manager
            </Link>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-sm text-muted-foreground">
                <span className="font-medium">{company.name}</span>
                <Badge variant="secondary" className="ml-2">
                  Admin Panel
                </Badge>
              </div>
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/projects">Projects</Link>
              </Button>
              <form action="/api/auth/signout" method="post">
                <Button variant="destructive" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Admin Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your company&apos;s expense system, users, and policies
            </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverviewTab tenant={tenant} session={session} />
          </TabsContent>

          <TabsContent value="projects">
            <AdminProjectsTab tenant={tenant} session={session} />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsersTab tenant={tenant} session={session} />
          </TabsContent>

          <TabsContent value="policies">
            <AdminPoliciesTab tenant={tenant} session={session} />
          </TabsContent>

          <TabsContent value="history">
            <AdminHistoryTab tenant={tenant} session={session} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default AdminDashboard
