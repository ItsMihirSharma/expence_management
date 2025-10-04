import { z } from "zod"
import { createApiHandler, createSuccessResponse, auditAction } from "@/lib/api-helpers"

const createExpenseSchema = z.object({
  projectId: z.string().cuid(),
  amountMinor: z.number().int().positive(), // Amount in minor units (cents)
  currency: z.string().length(3).default("USD"),
  description: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  paidBy: z.string().min(1).max(100),
  expenseDate: z.string().transform(str => new Date(str)),
})

const expenseQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ESCALATED"]).optional(),
  projectId: z.string().cuid().optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

// GET /api/expenses - List expenses with filtering
export const GET = createApiHandler({
  requiredRole: ["ADMIN", "MANAGER", "EMPLOYEE"], // All authenticated users
  handler: async ({ req, tenant, session }) => {
    const url = new URL(req.url)
    const rawParams = Object.fromEntries(url.searchParams.entries())
    
    // Convert string numbers to actual numbers for validation
    const searchParams: Record<string, string | number> = { ...rawParams }
    if (rawParams.limit) searchParams.limit = parseInt(rawParams.limit)
    if (rawParams.offset) searchParams.offset = parseInt(rawParams.offset)
    
    const query = expenseQuerySchema.parse(searchParams)

    // Build where clause based on role and filters
    const whereClause: Record<string, unknown> = {}

    // Role-based filtering
    if (session.role === "EMPLOYEE") {
      // Employees can only see their own expenses
      whereClause.employeeId = session.userId
    }
    // Admins and Managers can see all expenses in their company (via tenant scoping)

    // Apply additional filters
    if (query.status) {
      whereClause.status = query.status
    }
    
    if (query.projectId) {
      whereClause.projectId = query.projectId
    }
    
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {}
      if (query.startDate) dateFilter.gte = query.startDate
      if (query.endDate) dateFilter.lte = query.endDate
      whereClause.expenseDate = dateFilter
    }

    const [expenses, totalCount] = await Promise.all([
      tenant.expense.findMany({
        where: whereClause,
        include: {
          project: {
            select: { id: true, name: true }
          },
          employee: {
            select: { id: true, name: true, email: true }
          },
          receiptFiles: {
            select: { id: true, url: true, mime: true, size: true }
          },
          approvals: {
            include: {
              manager: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: query.limit,
        skip: query.offset
      }),
      tenant.expense.count({ where: whereClause })
    ])

    return createSuccessResponse({
      expenses,
      pagination: {
        total: totalCount,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < totalCount
      }
    })
  }
})

// POST /api/expenses - Create new expense
export const POST = createApiHandler({
  requiredRole: ["ADMIN", "MANAGER", "EMPLOYEE"], // All authenticated users can create expenses
  validationSchema: createExpenseSchema,
  handler: async ({ tenant, session, validatedData }) => {
    // Verify the project exists and belongs to the company (tenant guard handles this)
    const project = await tenant.project.findUnique({
      where: { id: validatedData!.projectId }
    })

    if (!project) {
      throw new Error("Project not found")
    }

    // Create the expense
    const expense = await tenant.expense.create({
      data: {
        ...validatedData!,
        employeeId: session.userId, // Always set to current user
        status: "PENDING", // New expenses start as pending
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        employee: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Audit log the creation
    await auditAction(
      tenant,
      "CREATE_EXPENSE", 
      "Expense", 
      expense.id,
      { 
        projectId: expense.projectId,
        projectName: project.name,
        amount: validatedData!.amountMinor / 100, // Convert to major units for logging
        currency: validatedData!.currency,
        category: validatedData!.category
      }
    )

    return createSuccessResponse(expense, "Expense created successfully")
  }
})
