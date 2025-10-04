/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireCompanyContext, getCompanyContext } from "@/lib/server-auth"

/**
 * Tenant-scoped Prisma client that automatically filters by companyId
 * This ensures all queries are automatically scoped to the user's company
 */
export class TenantPrisma {
  private companyId: string
  private userId: string

  constructor(companyId: string, userId: string) {
    this.companyId = companyId
    this.userId = userId
  }

  getCompanyId(): string {
    return this.companyId
  }

  getUserId(): string {
    return this.userId
  }

  /**
   * Create a tenant-scoped Prisma client from current session
   */
  static async fromSession(): Promise<TenantPrisma> {
    const context = await requireCompanyContext()
    return new TenantPrisma(context.companyId, context.userId)
  }

  /**
   * Create a tenant-scoped Prisma client if session exists, null otherwise
   */
  static async fromSessionOptional(): Promise<TenantPrisma | null> {
    const context = await getCompanyContext()
    if (!context) return null
    return new TenantPrisma(context.companyId, context.userId)
  }

  /**
   * Get the current company
   */
  async getCompany() {
    return prisma.company.findUniqueOrThrow({
      where: { id: this.companyId }
    })
  }

  /**
   * Company-scoped queries
   */
  get company() {
    return {
      findUnique: (args: Prisma.CompanyFindUniqueArgs) =>
        prisma.company.findUnique({
          ...args,
          where: { ...args.where, id: this.companyId }
        }),
      
      update: (args: Prisma.CompanyUpdateArgs) =>
        prisma.company.update({
          ...args,
          where: { ...args.where, id: this.companyId }
        })
    }
  }

  /**
   * Project queries (automatically scoped by company)
   */
  get project() {
    return {
      findMany: (args?: Prisma.ProjectFindManyArgs) =>
        prisma.project.findMany({
          ...args,
          where: { ...args?.where, companyId: this.companyId }
        }),

      findUnique: (args: Prisma.ProjectFindUniqueArgs) =>
        prisma.project.findUnique({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      create: (args: Prisma.ProjectCreateArgs) =>
        prisma.project.create({
          ...args,
          data: { ...args.data, company: { connect: { id: this.companyId } } } as Prisma.ProjectCreateInput
        }),

      update: (args: Prisma.ProjectUpdateArgs) =>
        prisma.project.update({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      delete: (args: Prisma.ProjectDeleteArgs) =>
        prisma.project.delete({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      count: (args?: Prisma.ProjectCountArgs) =>
        prisma.project.count({
          where: { ...args?.where, companyId: this.companyId },
          ...(args?.orderBy && { orderBy: args.orderBy }),
          ...(args?.cursor && { cursor: args.cursor }),
          ...(args?.take && { take: args.take }),
          ...(args?.skip && { skip: args.skip })
        })
    }
  }

  /**
   * Expense queries (automatically scoped by company through project relation)
   */
  get expense() {
    return {
      findMany: (args?: Prisma.ExpenseFindManyArgs) =>
        prisma.expense.findMany({
          ...args,
          where: { 
            ...args?.where, 
            project: { companyId: this.companyId }
          }
        }),

      findUnique: (args: Prisma.ExpenseFindUniqueArgs) =>
        prisma.expense.findUnique({
          ...args,
          where: { 
            ...args.where,
            project: { companyId: this.companyId }
          }
        }),

      create: async (args: Prisma.ExpenseCreateArgs) => {
        // Verify project belongs to company before creating expense
        await prisma.project.findUniqueOrThrow({
          where: { id: args.data.projectId, companyId: this.companyId }
        })
        
        return prisma.expense.create(args)
      },

      update: (args: Prisma.ExpenseUpdateArgs) =>
        prisma.expense.update({
          ...args,
          where: { 
            ...args.where,
            project: { companyId: this.companyId }
          }
        }),

      delete: (args: Prisma.ExpenseDeleteArgs) =>
        prisma.expense.delete({
          ...args,
          where: { 
            ...args.where,
            project: { companyId: this.companyId }
          }
        }),

      count: (args?: Prisma.ExpenseCountArgs) =>
        prisma.expense.count({
          where: { 
            ...args?.where, 
            project: { companyId: this.companyId }
          },
          ...(args?.orderBy && { orderBy: args.orderBy }),
          ...(args?.cursor && { cursor: args.cursor }),
          ...(args?.take && { take: args.take }),
          ...(args?.skip && { skip: args.skip })
        })
    }
  }

  /**
   * Membership queries (automatically scoped by company)
   */
  get membership() {
    return {
      findMany: (args?: Prisma.MembershipFindManyArgs) =>
        prisma.membership.findMany({
          ...args,
          where: { ...args?.where, companyId: this.companyId }
        }),

      findUnique: (args: Prisma.MembershipFindUniqueArgs) =>
        prisma.membership.findUnique({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      create: (args: Prisma.MembershipCreateArgs) =>
        prisma.membership.create({
          ...args,
          data: { ...args.data, companyId: this.companyId } as any
        }),

      update: (args: Prisma.MembershipUpdateArgs) =>
        prisma.membership.update({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      delete: (args: Prisma.MembershipDeleteArgs) =>
        prisma.membership.delete({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      count: (args?: Prisma.MembershipCountArgs) =>
        prisma.membership.count({
          where: { ...args?.where, companyId: this.companyId },
          ...(args?.orderBy && { orderBy: args.orderBy }),
          ...(args?.cursor && { cursor: args.cursor }),
          ...(args?.take && { take: args.take }),
          ...(args?.skip && { skip: args.skip })
        })
    }
  }

  /**
   * Approval Policy queries (automatically scoped by company)
   */
  get approvalPolicy() {
    return {
      findMany: (args?: Prisma.ApprovalPolicyFindManyArgs) =>
        prisma.approvalPolicy.findMany({
          ...args,
          where: { ...args?.where, companyId: this.companyId }
        }),

      findUnique: (args: Prisma.ApprovalPolicyFindUniqueArgs) =>
        prisma.approvalPolicy.findUnique({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        }),

      create: (args: Prisma.ApprovalPolicyCreateArgs) =>
        prisma.approvalPolicy.create({
          ...args,
          data: { ...args.data, companyId: this.companyId } as any
        }),

      update: (args: Prisma.ApprovalPolicyUpdateArgs) =>
        prisma.approvalPolicy.update({
          ...args,
          where: { ...args.where, companyId: this.companyId }
        })
    }
  }

  /**
   * Audit Log queries (automatically scoped by company)
   */
  get auditLog() {
    return {
      findMany: (args?: Prisma.AuditLogFindManyArgs) =>
        prisma.auditLog.findMany({
          ...args,
          where: { ...args?.where, companyId: this.companyId }
        }),

      create: (args: Prisma.AuditLogCreateArgs) =>
        prisma.auditLog.create({
          ...args,
          data: { 
            ...args.data, 
            companyId: this.companyId,
            actorUserId: args.data.actorUserId || this.userId
          } as any
        })
    }
  }

  /**
   * Exchange Rate Snapshot queries (automatically scoped by company)
   */
  get exchangeRateSnapshot() {
    return {
      findMany: (args?: Prisma.ExchangeRateSnapshotFindManyArgs) =>
        prisma.exchangeRateSnapshot.findMany({
          ...args,
          where: { ...args?.where, companyId: this.companyId }
        }),

      findFirst: (args?: Prisma.ExchangeRateSnapshotFindFirstArgs) =>
        prisma.exchangeRateSnapshot.findFirst({
          ...args,
          where: { ...args?.where, companyId: this.companyId }
        }),

      create: (args: Prisma.ExchangeRateSnapshotCreateArgs) =>
        prisma.exchangeRateSnapshot.create({
          ...args,
          data: { ...args.data, companyId: this.companyId } as any
        })
    }
  }

  /**
   * Raw Prisma access for complex queries (use with caution!)
   * Remember to manually add companyId filters when using this
   */
  get raw() {
    return prisma
  }

  /**
   * Helper to add audit log entry
   */
  async createAuditLog(action: string, entity: string, entityId: string, meta?: Record<string, unknown>) {
    return this.raw.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.DbNull,
        companyId: this.companyId,
        actorUserId: this.userId
      }
    })
  }
}
