"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { TenantPrisma } from "@/lib/tenant-guard"
import { format } from "date-fns"

interface ManagerDashboardProps {
  tenant: TenantPrisma
  session: { userId: string; companyId: string; role: string }
}

interface Expense {
  id: string
  description: string
  amountMinor: bigint
  currency: string
  category: string
  paidBy: string
  expenseDate: Date
  status: "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED"
  createdAt: Date
  project: {
    id: string
    name: string
  }
  employee: {
    id: string
    name: string | null
    email: string
  }
  receiptFiles: Array<{
    id: string
    url: string
    mime: string
    size: bigint
  }>
}

export function ManagerDashboard({ tenant }: ManagerDashboardProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [approvalDecision, setApprovalDecision] = useState<"APPROVE" | "REJECT">("APPROVE")
  const [approvalNote, setApprovalNote] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("PENDING")
  const router = useRouter()

  // Load expenses on mount
  React.useEffect(() => {
    const loadExpenses = async () => {
      try {
        const data = await tenant.raw.expense.findMany({
          where: {
            status: filterStatus as "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED"
          },
          include: {
            project: {
              select: { id: true, name: true }
            },
            employee: {
              select: { id: true, name: true, email: true }
            },
            receiptFiles: {
              select: { id: true, url: true, mime: true, size: true }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
        setExpenses(data as Expense[])
      } catch {
        toast.error("Failed to load expenses")
      } finally {
        setIsLoading(false)
      }
    }
    loadExpenses()
  }, [filterStatus])

  const handleApproval = async () => {
    if (!selectedExpense) return

    startTransition(async () => {
      try {
        const response = await fetch(`/api/expenses/${selectedExpense.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision: approvalDecision,
            note: approvalNote || undefined
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setExpenses(prev => prev.map(expense => 
              expense.id === selectedExpense.id 
                ? { ...expense, status: approvalDecision === "APPROVE" ? "APPROVED" : "REJECTED" }
                : expense
            ))
            setIsApprovalDialogOpen(false)
            setSelectedExpense(null)
            setApprovalNote("")
            toast.success(`Expense ${approvalDecision === "APPROVE" ? "approved" : "rejected"} successfully`)
            router.refresh()
          } else {
            toast.error(result.error || "Failed to process approval")
          }
        } else {
          toast.error("Failed to process approval")
        }
      } catch {
        toast.error("Failed to process approval")
      }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800"
      case "APPROVED": return "bg-green-100 text-green-800"
      case "REJECTED": return "bg-red-100 text-red-800"
      case "ESCALATED": return "bg-purple-100 text-purple-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const formatAmount = (amountMinor: bigint, currency: string) => {
    return `${(Number(amountMinor) / 100).toFixed(2)} ${currency}`
  }

  if (isLoading) {
    return <div>Loading expenses...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground">Review and approve employee expenses</p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ESCALATED">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <div className="grid gap-4">
        {expenses.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No expenses found for the selected status.</p>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {expense.description}
                      <Badge className={getStatusColor(expense.status)}>
                        {expense.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Project: {expense.project.name} • Employee: {expense.employee.name || expense.employee.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {formatAmount(expense.amountMinor, expense.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(expense.expenseDate, 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p>{expense.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Paid By</Label>
                    <p>{expense.paidBy}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submitted</Label>
                    <p>{format(expense.createdAt, 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Receipts</Label>
                    <p>{expense.receiptFiles.length} file(s)</p>
                  </div>
                </div>
                
                {expense.status === "PENDING" && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => {
                        setSelectedExpense(expense)
                        setApprovalDecision("APPROVE")
                        setIsApprovalDialogOpen(true)
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedExpense(expense)
                        setApprovalDecision("REJECT")
                        setIsApprovalDialogOpen(true)
                      }}
                      variant="destructive"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // View details
                        setSelectedExpense(expense)
                        setIsApprovalDialogOpen(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDecision === "APPROVE" ? "Approve" : "Reject"} Expense
            </DialogTitle>
            <DialogDescription>
              {selectedExpense && (
                <>
                  Review expense: <strong>{selectedExpense.description}</strong><br/>
                  Amount: <strong>{formatAmount(selectedExpense.amountMinor, selectedExpense.currency)}</strong><br/>
                  Employee: <strong>{selectedExpense.employee.name || selectedExpense.employee.email}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="approval-note">Note (Optional)</Label>
              <Textarea
                id="approval-note"
                placeholder="Add a note about your decision..."
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApprovalDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproval}
              disabled={isPending}
              className={approvalDecision === "APPROVE" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {approvalDecision === "APPROVE" ? "Approve" : "Reject"} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

