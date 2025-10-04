import { NextRequest, NextResponse } from "next/server"
import { ZodError, ZodSchema } from "zod"
import { TenantPrisma } from "@/lib/tenant-guard"
import { requireAuth, requireRole, MembershipRole } from "@/lib/server-auth"

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Create standardized API success response
 */
export function createSuccessResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  })
}

/**
 * Create standardized API error response
 */
export function createErrorResponse(
  error: string, 
  status: number = 400, 
  details?: unknown
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details ? { details } : {}),
    },
    { status }
  )
}

/**
 * Wrapper for API route handlers that provides:
 * - Authentication check
 * - Role-based authorization 
 * - Tenant-scoped database access
 * - Error handling
 * - Request validation
 */
export function createApiHandler<T = unknown>(options: {
  requiredRole?: MembershipRole | MembershipRole[]
  validationSchema?: ZodSchema<T>
  handler: (params: {
    req: NextRequest
    tenant: TenantPrisma
    session: Awaited<ReturnType<typeof requireAuth>>
    validatedData?: T
  }) => Promise<NextResponse>
}) {
  return async function apiHandler(req: NextRequest): Promise<NextResponse> {
    try {
      // Check authentication and roles
      const session = options.requiredRole 
        ? await requireRole(options.requiredRole)
        : await requireAuth()

      // Create tenant-scoped database access
      const tenant = new TenantPrisma(session.companyId, session.userId)

      // Validate request data if schema provided
      let validatedData: T | undefined
      if (options.validationSchema) {
        try {
          const body = await req.json()
          validatedData = options.validationSchema.parse(body)
        } catch (error) {
          if (error instanceof ZodError) {
            return createErrorResponse(
              "Invalid request data",
              400,
              error.issues
            )
          }
          throw error
        }
      }

      // Call the actual handler
      return options.handler({
        req,
        tenant,
        session,
        validatedData,
      })

    } catch (error) {
      console.error("API Handler Error:", error)

      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes("UNAUTHORIZED")) {
          return createErrorResponse("Unauthorized", 401)
        }
        if (error.message.includes("FORBIDDEN")) {
          return createErrorResponse("Forbidden", 403)
        }
        return createErrorResponse(error.message, 500)
      }

      return createErrorResponse("Internal server error", 500)
    }
  }
}

/**
 * Helper for server actions with authentication and tenant scoping
 */
export async function createServerAction<T = unknown>(options: {
  requiredRole?: MembershipRole | MembershipRole[]
  validationSchema?: ZodSchema<T>
  action: (params: {
    tenant: TenantPrisma
    session: Awaited<ReturnType<typeof requireAuth>>
    validatedData?: T
  }) => Promise<unknown>
}) {
  return async function serverAction(formData?: FormData | T): Promise<{ success: boolean; data?: unknown; error?: string; details?: unknown }> {
    try {
      // Check authentication and roles
      const session = options.requiredRole 
        ? await requireRole(options.requiredRole)
        : await requireAuth()

      // Create tenant-scoped database access
      const tenant = new TenantPrisma(session.companyId, session.userId)

      // Validate data if schema provided
      let validatedData: T | undefined
      if (options.validationSchema && formData) {
        // Handle both FormData and direct object input
        const data = formData instanceof FormData 
          ? Object.fromEntries(formData.entries())
          : formData
        
        validatedData = options.validationSchema.parse(data)
      }

      // Execute the action
      const result = await options.action({
        tenant,
        session,
        validatedData,
      })

      return { success: true, data: result }

    } catch (error) {
      console.error("Server Action Error:", error)
      
      if (error instanceof ZodError) {
        return {
          success: false,
          error: "Validation failed",
          details: error.issues
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }
}

/**
 * Audit log helper that automatically captures request context
 */
export async function auditAction(
  tenant: TenantPrisma,
  action: string,
  entity: string,
  entityId: string,
  meta?: Record<string, unknown>
) {
  return tenant.createAuditLog(action, entity, entityId, {
    timestamp: new Date().toISOString(),
    ...meta
  })
}
