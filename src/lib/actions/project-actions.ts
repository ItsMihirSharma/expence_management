"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createServerAction } from "@/lib/api-helpers"

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
  active: z.boolean().default(true),
})

const updateProjectSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, "Project name is required").max(100).optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
})

/**
 * Server action to create a new project
 * Only admins and managers can create projects
 */
export const createProject = createServerAction({
  requiredRole: ["ADMIN", "MANAGER"],
  validationSchema: createProjectSchema,
  action: async ({ tenant, session, validatedData }) => {
    const project = await tenant.raw.project.create({
      data: {
        ...validatedData!,
        companyId: tenant.getCompanyId()
      }
    })

    // Audit log the creation
    await tenant.createAuditLog(
      "CREATE_PROJECT",
      "Project",
      project.id,
      {
        projectName: project.name,
        createdBy: session.userId
      }
    )

    // Revalidate the projects page cache
    revalidatePath("/projects")
    revalidatePath("/dashboard")
    revalidatePath("/admin")

    return project
  }
})

/**
 * Server action to update a project
 * Only admins and managers can update projects
 */
export const updateProject = createServerAction({
  requiredRole: ["ADMIN", "MANAGER"],
  validationSchema: updateProjectSchema,
  action: async ({ tenant, session, validatedData }) => {
    const { id, ...updateData } = validatedData!
    
    // Get the existing project to compare changes
    const existingProject = await tenant.project.findUnique({
      where: { id }
    })

    if (!existingProject) {
      throw new Error("Project not found")
    }

    const updatedProject = await tenant.project.update({
      where: { id },
      data: updateData
    })

    // Audit log the update with changes
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (updateData.name && updateData.name !== existingProject.name) {
      changes.name = { from: existingProject.name, to: updateData.name }
    }
    if (updateData.description !== undefined && updateData.description !== existingProject.description) {
      changes.description = { from: existingProject.description, to: updateData.description }
    }
    if (updateData.active !== undefined && updateData.active !== existingProject.active) {
      changes.active = { from: existingProject.active, to: updateData.active }
    }

    await tenant.createAuditLog(
      "UPDATE_PROJECT",
      "Project",
      id,
      {
        projectName: updatedProject.name,
        changes,
        updatedBy: session.userId
      }
    )

    // Revalidate relevant pages
    revalidatePath("/projects")
    revalidatePath(`/projects/${id}`)
    revalidatePath("/dashboard")
    
    return updatedProject
  }
})

/**
 * Server action to delete a project
 * Only admins can delete projects
 */
export const deleteProject = createServerAction({
  requiredRole: ["ADMIN"], // Only admins can delete
  validationSchema: z.object({
    id: z.string().min(1, "Project ID is required")
  }),
  action: async ({ tenant, session, validatedData }) => {
    const id = validatedData?.id as string
    
    if (!id) {
      throw new Error("Project ID is required")
    }

    // Get the project before deletion for audit log
    const project = await tenant.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            expenses: true
          }
        }
      }
    })

    if (!project) {
      throw new Error("Project not found")
    }

    // Check if project has expenses
    const expenseCount = await tenant.expense.count({
      where: { projectId: id }
    })
    
    if (expenseCount > 0) {
      throw new Error("Cannot delete project with existing expenses")
    }

    await tenant.project.delete({
      where: { id }
    })

    // Audit log the deletion
    await tenant.createAuditLog(
      "DELETE_PROJECT",
      "Project",
      id,
      {
        projectName: project.name,
        deletedBy: session.userId
      }
    )

    // Revalidate and redirect
    revalidatePath("/projects")
    revalidatePath("/dashboard")
    redirect("/projects")
  }
})

/**
 * Server action to toggle project active status
 * Admins and managers can toggle project status
 */
export const toggleProjectStatus = createServerAction({
  requiredRole: ["ADMIN", "MANAGER"],
  validationSchema: z.object({
    id: z.string().min(1, "Project ID is required"),
    active: z.boolean()
  }),
  action: async ({ tenant, session, validatedData }) => {
    const { id, active } = validatedData!
    
    if (!id) {
      throw new Error("Project ID is required")
    }

    // Check if project exists
    const project = await tenant.project.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!project) {
      throw new Error("Project not found")
    }

    // Update the active status
    const updatedProject = await tenant.project.update({
      where: { id },
      data: { active }
    })

    // Audit log the status change
    await tenant.createAuditLog(
      "TOGGLE_PROJECT_STATUS",
      "Project",
      id,
      {
        projectName: project.name,
        statusChange: { from: project.active, to: !project.active },
        updatedBy: session.userId
      }
    )

    // Revalidate relevant pages
    revalidatePath("/projects")
    revalidatePath(`/projects/${id}`)
    revalidatePath("/dashboard")
    
    return updatedProject
  }
})
