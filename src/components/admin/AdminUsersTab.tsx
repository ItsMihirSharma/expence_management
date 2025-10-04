"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Edit2, Mail, Key, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { TenantPrisma } from "@/lib/tenant-guard"
import { EmailService } from "@/lib/email"

interface AdminUsersTabProps {
  tenant: TenantPrisma
  session: { userId: string; companyId: string; role: string }
}

interface User {
  id: string
  email: string
  name?: string | null
  createdAt: Date
  memberships: Array<{
    role: string
    company: {
      name: string
    }
  }>
}

interface Project {
  id: string
  name: string
  active: boolean
}

export function AdminUsersTab({ tenant }: AdminUsersTabProps) {
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [company, setCompany] = useState<{ name: string; domain: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Load users and company on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Load company data
        const companyData = await tenant.raw.company.findUnique({
          where: { id: tenant.getCompanyId() },
          select: { name: true }
        })
        
        if (companyData) {
          // Generate domain from company name
          const domain = companyData.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20) + '.com'
          setCompany({ name: companyData.name, domain })
        }

        // Load projects
        const projectsData = await tenant.project.findMany({
          where: { active: true },
          select: { id: true, name: true, active: true },
          orderBy: { name: 'asc' }
        })
        setProjects(projectsData)

        // Load users
        const data = await tenant.raw.user.findMany({
          include: {
            memberships: {
              include: {
                company: {
                  select: { name: true }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
        setUsers(data)
      } catch {
        toast.error("Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // Generate a random password
  const generatePassword = () => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  const handleCreateUser = async (formData: FormData) => {
    const username = formData.get("username") as string
    const name = formData.get("name") as string
    const role = formData.get("role") as string
    const projectId = formData.get("projectId") as string
    const password = generatePassword()

    if (!company) {
      toast.error("Company information not loaded")
      return
    }

    if (!projectId) {
      toast.error("Please select a project")
      return
    }

    // Generate company-assigned email
    const email = `${username}@${company.domain}`

    startTransition(async () => {
      try {
        // Hash the password
        const { hash } = await import("bcryptjs")
        const hashedPassword = await hash(password, 12)

        // Create user
        const user = await tenant.raw.user.create({
          data: {
            email,
            name: name || undefined,
            passwordHash: hashedPassword,
          }
        })

        // Create membership
        await tenant.membership.create({
          data: {
            userId: user.id,
            companyId: tenant.getCompanyId(),
            role: role as "ADMIN" | "MANAGER" | "EMPLOYEE"
          }
        })

        // Assign user to project
        await tenant.raw.userProject.create({
          data: {
            userId: user.id,
            projectId: projectId
          }
        })

        // Get project and company details for email
        const project = projects.find(p => p.id === projectId)
        const projectName = project?.name || 'Unknown Project'

        // Send email with credentials
        const emailSent = await EmailService.sendUserCredentials({
          email,
          password,
          name: name || undefined,
          companyName: company.name,
          projectName,
          role: role
        })

        // Refresh users list
        const updatedUsers = await tenant.raw.user.findMany({
          include: {
            memberships: {
              include: {
                company: {
                  select: { name: true }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
        setUsers(updatedUsers)

        setIsCreateDialogOpen(false)

        if (emailSent) {
          toast.success(`User created successfully! Credentials sent to ${email}`, {
            duration: 8000,
          })
        } else {
          toast.success(`User created successfully! Email: ${email}, Password: ${password}`, {
            duration: 10000,
          })
        }

        router.refresh()
      } catch {
        toast.error("Failed to create user")
      }
    })
  }

  const handleResetPassword = async (userId: string) => {
    startTransition(async () => {
      try {
        const password = generatePassword()
        const { hash } = await import("bcryptjs")
        const hashedPassword = await hash(password, 12)

        await tenant.raw.user.update({
          where: { id: userId },
          data: { passwordHash: hashedPassword }
        })

        // In a real app, send email here
        toast.success(`Password reset successfully! New password: ${password}`, {
          duration: 10000,
        })
      } catch {
        toast.error("Failed to reset password")
      }
    })
  }

  if (isLoading) {
    return <div>Loading users...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form action={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new team member with company-assigned email and role assignment
                  {company && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                      <strong>Company Domain:</strong> {company.domain}
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <div className="flex items-center">
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="john.doe"
                      required
                      className="rounded-r-none"
                    />
                    {company && (
                      <span className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md text-sm text-gray-600 dark:text-gray-400">
                        @{company.domain}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Full email will be: username@{company?.domain}
                  </p>
                </div>
                <div>
                  <Label htmlFor="name">Full Name (Optional)</Label>
                  <Input id="name" name="name" placeholder="John Doe" />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select name="role" defaultValue="EMPLOYEE">
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="projectId">Assign to Project</Label>
                  <Select name="projectId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {projects.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No active projects found. Create a project first.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending || !company || projects.length === 0}>
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users List */}
      <div className="grid gap-6">
        {users.map((user) => {
          const membership = user.memberships[0] // Get first membership for this company

          return (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {user.name || user.email}
                      <Badge variant={
                        membership?.role === "ADMIN" ? "default" :
                        membership?.role === "MANAGER" ? "secondary" :
                        "outline"
                      }>
                        {membership?.role || "No Role"}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(user.id)}
                      disabled={isPending}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Reset Password
                    </Button>

                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-1" />
                      Send Email
                    </Button>

                    <Button variant="outline" size="sm">
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit Role
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Company: {membership?.company.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Joined: {user.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {users.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Users Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add team members to start using the expense management system.
            </p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First User
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* User Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {users.filter(u => u.memberships.some(m => m.role === "ADMIN")).length}
              </div>
              <div className="text-sm text-muted-foreground">Admins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {users.filter(u => u.memberships.some(m => m.role === "MANAGER")).length}
              </div>
              <div className="text-sm text-muted-foreground">Managers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {users.filter(u => u.memberships.some(m => m.role === "EMPLOYEE")).length}
              </div>
              <div className="text-sm text-muted-foreground">Employees</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
