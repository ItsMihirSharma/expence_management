import Link from "next/link";
import { Calendar, DollarSign, FileText, Users, TrendingUp, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAuth, hasRole, isManagerOrAbove, MembershipRole } from "@/lib/server-auth";
import { TenantPrisma } from "@/lib/tenant-guard";

interface DashboardData {
  totalExpenses: number
  pendingExpenses: number
  thisMonthExpenses: number
  projectCount: number
  recentExpenses: Array<{
    id: string;
    description: string;
    amountMinor: bigint;
    currency: string;
    status: string;
    expenseDate: Date;
    createdAt: Date;
    category: string;
    paidBy: string;
    projectId: string;
    employeeId: string;
  }>
  companyStats?: {
    totalEmployees: number
    totalProjects: number
  }
}

async function getDashboardData(
  tenant: TenantPrisma, 
  session: { userId: string; role: MembershipRole }, 
  canViewAll: boolean
): Promise<DashboardData> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  // Base expense filter - employees see only their own, managers see all
  const expenseFilter = canViewAll ? {} : { where: { employeeId: session.userId } }

  const [
    totalExpenses,
    pendingExpenses, 
    thisMonthExpenses,
    projectCount,
    recentExpenses,
    companyStats
  ] = await Promise.all([
    // Total expense count
    tenant.expense.count(expenseFilter),
    
    // Pending expenses count
    tenant.expense.count({ 
      ...expenseFilter,
      where: {
        ...expenseFilter.where,
        status: "PENDING" 
      }
    }),
    
    // This month's expenses count
    tenant.expense.count({ 
      ...expenseFilter,
      where: {
        ...expenseFilter.where,
        createdAt: { gte: startOfMonth }
      }
    }),
    
    // Active project count
    tenant.project.count({ where: { active: true } }),
    
    // Recent expenses
    tenant.expense.findMany({
      where: expenseFilter.where || {},
      include: {
        project: { select: { name: true } },
        employee: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    
    // Company stats (only for managers/admins)
    canViewAll ? Promise.all([
      tenant.membership.count(),
      tenant.project.count()
    ]).then(([employees, projects]) => ({ 
      totalEmployees: employees, 
      totalProjects: projects 
    })) : null
  ])

  return {
    totalExpenses,
    pendingExpenses,
    thisMonthExpenses,
    projectCount,
    recentExpenses,
    companyStats: companyStats || undefined
  }
}

async function Dashboard() {
  // Require authentication for this page
  const session = await requireAuth()
  
  // Create tenant-scoped database access
  const tenant = new TenantPrisma(session.companyId, session.userId)
  
  // Check permissions for conditional rendering
  const canViewAllExpenses = await isManagerOrAbove()
  const isAdmin = await hasRole("ADMIN")

  // Get dashboard data based on user role
  const dashboardData = await getDashboardData(tenant, session, canViewAllExpenses)

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
                Welcome, {session.name || session.email}
                <Badge variant="secondary" className="ml-2">
                  {session.role}
                </Badge>
              </div>
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/projects">Projects</Link>
              </Button>
              {canViewAllExpenses && (
                <Button variant="outline" asChild>
                  <Link href="/reports">Reports</Link>
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              {canViewAllExpenses && (
                <Button variant="outline" asChild>
                  <Link href="/manager">Manager</Link>
                </Button>
              )}
              <form action="/api/auth/signout" method="post">
                <Button variant="destructive" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            {session.role === "EMPLOYEE" 
              ? "Track your expenses and projects"
              : "Overview of company expenses and projects"
            }
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    {canViewAllExpenses ? "Total Expenses" : "My Expenses"}
                  </p>
                  <p className="text-2xl font-bold">{dashboardData.totalExpenses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{dashboardData.pendingExpenses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">{dashboardData.thisMonthExpenses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold">{dashboardData.projectCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Stats (Admin/Manager only) */}
        {dashboardData.companyStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-indigo-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                    <p className="text-2xl font-bold">{dashboardData.companyStats.totalEmployees}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                    <p className="text-2xl font-bold">{dashboardData.companyStats.totalProjects}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Expenses</span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/expenses">
                  <Eye className="h-4 w-4 mr-2" />
                  View All
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.recentExpenses.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {expense.category} • {expense.paidBy}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expense.expenseDate.toLocaleDateString()}
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
                <p className="text-muted-foreground">No expenses yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/expenses/new">Create Your First Expense</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Your Access Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Data Access</h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    {canViewAllExpenses ? "All company data" : "Your personal data"}
                  </li>
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    Automatic company scoping
                  </li>
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    Audit trail logging
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Permissions</h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    Create & manage expenses
                  </li>
                  {canViewAllExpenses && (
                    <li className="flex items-center">
                      <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                      Approve team expenses
                    </li>
                  )}
                  {isAdmin && (
                    <li className="flex items-center">
                      <div className="h-2 w-2 bg-blue-500 rounded-full mr-2" />
                      Full admin access
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Security</h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    Role-based access control
                  </li>
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    Multi-tenant data isolation
                  </li>
                  <li className="flex items-center">
                    <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
                    Session-based authentication
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard