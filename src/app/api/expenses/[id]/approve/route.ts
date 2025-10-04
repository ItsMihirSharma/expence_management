import { NextResponse } from "next/server"
import { createApiHandler, createSuccessResponse } from "@/lib/api-helpers"
import { z } from "zod"

const approveExpenseSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().optional(),
})

// POST /api/expenses/[id]/approve - Approve or reject an expense (Manager/Admin only)
export const POST = createApiHandler({
  requiredRole: ["MANAGER", "ADMIN"], // Only managers and admins can approve expenses
  validationSchema: approveExpenseSchema,
  handler: async ({ tenant, session, validatedData, req }) => {
    const url = new URL(req.url)
    const expenseId = url.pathname.split('/').pop()
    
    if (!expenseId) {
      return NextResponse.json(
        { error: "Expense ID is required" },
        { status: 400 }
      )
    }
    
    const { decision, note } = validatedData!

    // Get the expense to verify it exists and is pending
    const expense = await tenant.raw.expense.findUnique({
      where: { id: expenseId },
      include: {
        project: {
          select: { companyId: true }
        }
      }
    })

    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      )
    }

    // Verify the expense belongs to the same company
    if (expense.project.companyId !== session.companyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    // Check if expense is pending
    if (expense.status !== "PENDING") {
      return NextResponse.json(
        { error: "Expense is not pending approval" },
        { status: 400 }
      )
    }

    // Update the expense status
    const updatedExpense = await tenant.raw.expense.update({
      where: { id: expenseId },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED"
      }
    })

    // Create approval record
    await tenant.raw.approval.create({
      data: {
        expenseId: expenseId,
        managerId: session.userId,
        decision: decision === "APPROVE" ? "APPROVE" : "REJECT",
        note: note || null,
        decidedAt: new Date()
      }
    })

    // Create audit log
    await tenant.raw.auditLog.create({
      data: {
        companyId: session.companyId,
        actorUserId: session.userId,
        action: `EXPENSE_${decision}`,
        entity: "Expense",
        entityId: expenseId,
        meta: {
          expenseDescription: expense.description,
          amount: Number(expense.amountMinor),
          currency: expense.currency,
          decision,
          note
        }
      }
    })

    return createSuccessResponse(updatedExpense, `Expense ${decision.toLowerCase()}d successfully`)
  }
})

