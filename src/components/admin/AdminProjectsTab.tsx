"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Edit2, Trash2, Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { TenantPrisma } from "@/lib/tenant-guard"
// Removed unused server action imports - using API calls instead

interface AdminProjectsTabProps {
  tenant: TenantPrisma
  session: { userId: string; companyId: string; role: string }
}

interface Project {
  id: string
  name: string
  description?: string | null
  active: boolean
  createdAt: Date
  _count?: {
    expenses: number
  }
}

export function AdminProjectsTab({ tenant }: AdminProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Load projects on mount
  useState(() => {
    const loadProjects = async () => {
      try {
        const data = await tenant.project.findMany({
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
        setProjects(data)
      } catch {
        toast.error("Failed to load projects")
      } finally {
        setIsLoading(false)
      }
    }
    loadProjects()
  })

  const handleCreateProject = async (formData: FormData) => {
    const name = formData.get("name") as string
    const description = formData.get("description") as string
    const active = formData.get("active") === "on"

    startTransition(async () => {
      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
            active
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setProjects(prev => [result.data, ...prev])
            setIsCreateDialogOpen(false)
            toast.success("Project created successfully")
            router.refresh()
          } else {
            toast.error(result.error || "Failed to create project")
          }
        } else {
          const errorText = await response.text()
          console.error("API Error:", response.status, errorText)
          toast.error(`Failed to create project: ${response.status}`)
        }
      } catch (error) {
        console.error("Form submission error:", error)
        toast.error("Failed to create project")
      }
    })
  }

  const handleUpdateProject = async (formData: FormData) => {
    const id = formData.get("id") as string
    const name = formData.get("name") as string
    const description = formData.get("description") as string
    const active = formData.get("active") === "on"

    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
            active
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setProjects(prev => prev.map(p => p.id === id ? result.data : p))
            setEditingProject(null)
            toast.success("Project updated successfully")
            router.refresh()
          } else {
            toast.error(result.error || "Failed to update project")
          }
        } else {
          toast.error("Failed to update project")
        }
      } catch {
        toast.error("Failed to update project")
      }
    })
  }

  const handleDeleteProject = async (projectId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setProjects(prev => prev.filter(p => p.id !== projectId))
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

  const handleToggleStatus = async (projectId: string, currentActive: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/toggle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            active: !currentActive
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setProjects(prev => prev.map(p => p.id === projectId ? result.data : p))
            toast.success(`Project ${!currentActive ? "activated" : "deactivated"}`)
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

  if (isLoading) {
    return <div>Loading projects...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Project Management</h2>
          <p className="text-muted-foreground">Create and manage company projects</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleCreateProject(formData);
            }}>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Add a new project for expense tracking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Project Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="active" name="active" defaultChecked />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  Create Project
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects List */}
      <div className="grid gap-6">
        {projects.map((project) => (
          <Card key={project.id} className={!project.active ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {project.name}
                    <Badge variant={project.active ? "default" : "secondary"}>
                      {project.active ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {project.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(project.id, project.active)}
                    disabled={isPending}
                  >
                    {project.active ? (
                      <Pause className="h-4 w-4 mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    {project.active ? "Pause" : "Activate"}
                  </Button>

                  <Dialog open={editingProject?.id === project.id} onOpenChange={(open) => !open && setEditingProject(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleUpdateProject(formData);
                      }}>
                        <input type="hidden" name="id" value={project.id} />
                        <DialogHeader>
                          <DialogTitle>Edit Project</DialogTitle>
                          <DialogDescription>
                            Update project information
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label htmlFor={`edit-name-${project.id}`}>Project Name</Label>
                            <Input id={`edit-name-${project.id}`} name="name" defaultValue={project.name} />
                          </div>
                          <div>
                            <Label htmlFor={`edit-description-${project.id}`}>Description</Label>
                            <Textarea id={`edit-description-${project.id}`} name="description" defaultValue={project.description || ""} />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id={`edit-active-${project.id}`} name="active" defaultChecked={project.active} />
                            <Label htmlFor={`edit-active-${project.id}`}>Active</Label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={isPending}>
                            Update Project
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {project._count?.expenses === 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProject(project.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold">{project._count?.expenses || 0}</p>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Created</p>
                  <p>{project.createdAt.toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first project to start tracking expenses.
            </p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
