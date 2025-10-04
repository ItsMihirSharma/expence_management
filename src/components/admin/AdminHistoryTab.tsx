"use client"

import { useState, useTransition } from "react"
import { Calendar, Filter, Search, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { TenantPrisma } from "@/lib/tenant-guard"

interface AdminHistoryTabProps {
  tenant: TenantPrisma
  session: { userId: string; companyId: string; role: string }
}

interface Expense {
  id: string
  description: string
  amountMinor: bigint
  currency: string
  category: string
  status: string
  expenseDate: Date
  createdAt: Date
  projectId: string
  employeeId: string
  project: {
    name: string
  }
  employee: {
    name: string | null
    email: string
  }
  approvals: Array<{
    manager: {
      name: string | null
      email: string
    }
    decision: string
    decidedAt: Date | null
  }>
}

export function AdminHistoryTab({ tenant }: AdminHistoryTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [projectFilter, setProjectFilter] = useState<string>("ALL")
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [isPending, startTransition] = useTransition()

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  // Load initial data
  useState(() => {
    const loadData = async () => {
      try {
        const [expensesData, projectsData] = await Promise.all([
          tenant.raw.expense.findMany({
            include: {
              project: { select: { name: true } },
              employee: { select: { name: true, email: true } },
              approvals: {
                include: {
                  manager: { select: { name: true, email: true } }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          }),
          tenant.project.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
          })
        ])

        setExpenses(expensesData)
        setProjects(projectsData)
      } catch {
        toast.error("Failed to load history data")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  })

  const handleFilter = async () => {
    startTransition(async () => {
      try {
        const whereClause: Record<string, unknown> = {}

        if (searchTerm) {
          whereClause.OR = [
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { category: { contains: searchTerm, mode: 'insensitive' } },
            { employee: { name: { contains: searchTerm, mode: 'insensitive' } } },
            { employee: { email: { contains: searchTerm, mode: 'insensitive' } } }
          ]
        }

        if (statusFilter !== "ALL") {
          whereClause.status = statusFilter
        }

        if (projectFilter !== "ALL") {
          whereClause.projectId = projectFilter
        }

        if (dateRange.start || dateRange.end) {
          const dateFilter: Record<string, Date> = {}
          if (dateRange.start) dateFilter.gte = new Date(dateRange.start)
          if (dateRange.end) dateFilter.lte = new Date(dateRange.end)
          whereClause.expenseDate = dateFilter
        }

        const filteredExpenses = await tenant.raw.expense.findMany({
          where: whereClause,
          include: {
            project: { select: { name: true } },
            employee: { select: { name: true, email: true } },
            approvals: {
              include: {
                manager: { select: { name: true, email: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        setExpenses(filteredExpenses)
      } catch {
        toast.error("Failed to filter expenses")
      }
    })
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      PENDING: "secondary",
      APPROVED: "default",
      REJECTED: "destructive",
      ESCALATED: "outline"
    } as const
    return variants[status as keyof typeof variants] || "outline"
  }

  if (isLoading) {
    return <div>Loading expense history...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Expense History</h2>
          <p className="text-muted-foreground">View and filter all company expenses</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Description, category, employee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ESCALATED">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Date Range</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  placeholder="Start date"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleFilter} disabled={isPending}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Expenses ({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approvals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">
                      {expense.description}
                    </TableCell>
                    <TableCell>{expense.project.name}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{expense.employee.name || expense.employee.email}</div>
                        <div className="text-sm text-muted-foreground">{expense.employee.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        ${(Number(expense.amountMinor) / 100).toFixed(2)} {expense.currency}
                      </span>
                    </TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {expense.expenseDate.toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadge(expense.status)}>
                        {expense.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {expense.approvals.length > 0 ? (
                        <div className="space-y-1">
                          {expense.approvals.map((approval, index) => (
                            <div key={index} className="text-xs">
                              <span className="font-medium">{approval.manager.name || approval.manager.email}</span>
                              <Badge
                                variant={approval.decision === "APPROVE" ? "default" : "destructive"}
                                className="ml-1 text-xs"
                              >
                                {approval.decision}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No approvals</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No expenses found matching the current filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {expenses.filter(e => e.status === "APPROVED").length}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {expenses.filter(e => e.status === "PENDING").length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {expenses.filter(e => e.status === "REJECTED").length}
            </div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              ${expenses
                .filter(e => e.status === "APPROVED")
                .reduce((sum, e) => sum + Number(e.amountMinor), 0) / 100
              }
            </div>
            <div className="text-sm text-muted-foreground">Total Approved</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
