"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Play, Pause, Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ProjectActionsProps {
  projectId: string
  isActive: boolean
  canManageProjects: boolean
  isAdmin: boolean
  hasExpenses: boolean
}

export function ProjectActions({ 
  projectId, 
  isActive, 
  canManageProjects, 
  isAdmin, 
  hasExpenses 
}: ProjectActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleToggleStatus = async () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/toggle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            active: !isActive
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            toast.success(`Project ${!isActive ? "activated" : "deactivated"}`)
            router.refresh()
          } else {
            toast.error(result.error || "Failed to update project status")
          }
        } else {
          toast.error("Failed to update project status")
        }
      } catch {
        toast.error("Failed to update project status")
      }
    })
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            toast.success("Project deleted successfully")
            router.refresh()
          } else {
            toast.error(result.error || "Failed to delete project")
          }
        } else {
          toast.error("Failed to delete project")
        }
      } catch {
        toast.error("Failed to delete project")
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Managers and admins can edit */}
      {canManageProjects && (
        <>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleStatus}
            disabled={isPending}
          >
            {isActive ? (
              <Pause className="h-4 w-4 mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            {isActive ? "Pause" : "Resume"}
          </Button>
          
          <Button variant="outline" size="sm">
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </>
      )}

      {/* Only admins can delete (and only if no expenses) */}
      {isAdmin && !hasExpenses && (
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      )}
    </div>
  )
}
