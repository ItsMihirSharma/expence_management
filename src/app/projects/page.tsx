import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  requireAuth, 
  hasRole, 
  isManagerOrAbove 
} from "@/lib/server-auth"
import { TenantPrisma } from "@/lib/tenant-guard"
import { ProjectManagementButtons } from "@/components/projects/ProjectManagementButtons"
import { ProjectActions } from "@/components/projects/ProjectActions"
// Removed server action imports - using API calls instead
import { Project } from "@prisma/client"

type ProjectWithCount = Project & {
  _count: {
    expenses: number
  }
}

async function ProjectsPage() {
  // Require authentication
  const session = await requireAuth()
  
  // Create tenant-scoped database access
  const tenant = new TenantPrisma(session.companyId, session.userId)
  
  // Get projects with expense counts
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

  // Check user permissions for rendering different UI elements
  const canManageProjects = await isManagerOrAbove()
  const isAdmin = await hasRole("ADMIN")

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your company projects and track expenses
          </p>
        </div>
        
        {/* Only show create button to managers and admins */}
        <ProjectManagementButtons 
          canManageProjects={canManageProjects} 
          hasProjects={projects.length > 0} 
        />
      </div>

      {/* Role-based welcome message */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Welcome, {session.name}</h3>
              <p className="text-muted-foreground">
                Role: <Badge variant="secondary">{session.role}</Badge>
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-sm text-muted-foreground">
                {session.role === "EMPLOYEE" ? "Available Projects" : "Total Projects"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card key={project.id} className={!project.active ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={project.active ? "default" : "secondary"}>
                    {project.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground">
                  {project.description}
                </p>
              )}
            </CardHeader>
            
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-2xl font-bold">{(project as ProjectWithCount)._count?.expenses || 0}</p>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Created</p>
                  <p>{project.createdAt.toLocaleDateString()}</p>
                </div>
              </div>

              {/* Action buttons based on role */}
              <div className="flex gap-2">
                {/* All users can view project details */}
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>

                <ProjectActions
                  projectId={project.id}
                  isActive={project.active}
                  canManageProjects={canManageProjects}
                  isAdmin={isAdmin}
                  hasExpenses={(project as ProjectWithCount)._count?.expenses > 0}
                />
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
              {canManageProjects 
                ? "Create your first project to start tracking expenses."
                : "No projects available yet. Contact your manager."
              }
            </p>
            <ProjectManagementButtons 
              canManageProjects={canManageProjects} 
              hasProjects={projects.length > 0} 
            />
          </CardContent>
        </Card>
      )}

      {/* Role-specific information panel */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Project Access</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ View all company projects</li>
                <li>✓ Submit expenses to projects</li>
                {canManageProjects && <li>✓ Create and edit projects</li>}
                {isAdmin && <li>✓ Delete empty projects</li>}
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Expense Management</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Create expense reports</li>
                <li>✓ Upload receipt files</li>
                {session.role !== "EMPLOYEE" && <li>✓ View all team expenses</li>}
                {canManageProjects && <li>✓ Approve/reject expenses</li>}
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Company Data</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• All queries scoped to your company</li>
                <li>• Automatic audit logging</li>
                <li>• Role-based data filtering</li>
                {isAdmin && <li>• Full company administration</li>}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProjectsPage
