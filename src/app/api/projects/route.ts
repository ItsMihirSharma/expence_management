import { z } from "zod"
import { createApiHandler, createSuccessResponse, auditAction } from "@/lib/api-helpers"

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  active: z.boolean().default(true),
})

// GET /api/projects - List all projects for the user's company
export const GET = createApiHandler({
  requiredRole: ["ADMIN", "MANAGER", "EMPLOYEE"], // All authenticated users
  handler: async ({ tenant }) => {
    const projects = await tenant.project.findMany({
      include: {
        _count: {
          select: {
            expenses: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return createSuccessResponse(projects)
  }
})

// POST /api/projects - Create new project (Admin only)
export const POST = createApiHandler({
  requiredRole: ["ADMIN"], // Only admins can create projects
  validationSchema: createProjectSchema,
  handler: async ({ tenant, session, validatedData }) => {
    const project = await tenant.raw.project.create({
      data: {
        ...validatedData!,
        companyId: session.companyId
      }
    })

    // Audit log the creation
    await auditAction(
      tenant,
      "CREATE_PROJECT", 
      "Project", 
      project.id,
      { 
        projectName: project.name,
        createdBy: session.userId 
      }
    )

    return createSuccessResponse(project, "Project created successfully")
  }
})
