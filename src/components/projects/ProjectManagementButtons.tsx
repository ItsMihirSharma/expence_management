"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ProjectManagementButtonsProps {
  canManageProjects: boolean
  hasProjects: boolean
}

export function ProjectManagementButtons({ canManageProjects, hasProjects }: ProjectManagementButtonsProps) {
  const router = useRouter()

  if (!canManageProjects) {
    return null
  }

  const handleManageProjects = () => {
    router.push('/admin')
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleManageProjects}>
        <Plus className="h-4 w-4 mr-2" />
        {hasProjects ? "Manage Projects" : "Create First Project"}
      </Button>
    </div>
  )
}


