import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, FileText, DollarSign, TrendingUp, Activity } from "lucide-react"
import { TenantPrisma } from "@/lib/tenant-guard"

interface AdminOverviewTabProps {
  tenant: TenantPrisma
  session: { userId: string; companyId: string; role: string }
}

export async function AdminOverviewTab({ tenant, session }: AdminOverviewTabProps) {
  const [
    companyInfo,
    totalUsers,
    activeProjects,
    totalExpenses,
    pendingExpenses,
    recentActivity
  ] = await Promise.all([
    tenant.getCompany(),
    tenant.membership.count(),
    tenant.project.count({ where: { active: true } }),
    tenant.expense.count(),
    tenant.expense.count({ where: { status: "PENDING" } }),
    tenant.raw.expense.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        employee: { select: { name: true, email: true } }
      }
    })
  ])

  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      description: "Active team members",
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Active Projects",
      value: activeProjects,
      description: "Projects in progress",
      icon: FileText,
      color: "text-green-600"
    },
    {
      title: "Total Expenses",
      value: totalExpenses,
      description: "All-time expense reports",
      icon: DollarSign,
      color: "text-purple-600"
    },
    {
      title: "Pending Approvals",
      value: pendingExpenses,
      description: "Awaiting manager review",
      icon: Activity,
      color: "text-orange-600"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Company Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Company Name</p>
              <p className="text-lg font-semibold">{companyInfo.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Base Currency</p>
              <p className="text-lg font-semibold">{companyInfo.baseCurrency}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Admin User</p>
              <p className="text-lg font-semibold">{session.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {expense.project.name} • {expense.employee.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expense.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ${(Number(expense.amountMinor) / 100).toFixed(2)} {expense.currency}
                    </p>
                    <Badge
                      variant={
                        expense.status === "APPROVED" ? "default" :
                        expense.status === "PENDING" ? "secondary" :
                        expense.status === "REJECTED" ? "destructive" : "outline"
                      }
                    >
                      {expense.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Database Connection</h4>
              <Badge variant="default">Connected</Badge>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Authentication</h4>
              <Badge variant="default">Active</Badge>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Email Service</h4>
              <Badge variant="secondary">Stub (Configure SMTP)</Badge>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Audit Logging</h4>
              <Badge variant="default">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
