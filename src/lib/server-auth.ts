import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export type MembershipRole = "ADMIN" | "MANAGER" | "EMPLOYEE"

export interface AuthSession {
  userId: string
  companyId: string
  role: MembershipRole
  email: string
  name?: string
}

/**
 * Server-side session wrapper that returns structured user session data
 */
export async function getSession(): Promise<AuthSession | null> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return null
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    role: session.user.role as MembershipRole,
    email: session.user.email,
    name: session.user.name,
  }
}

/**
 * Server-side helper to require authentication and return session
 * Redirects to login if not authenticated
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession()
  
  if (!session) {
    redirect("/login")
  }
  
  return session
}

/**
 * Server-side role checker for route handlers and server actions
 * @param allowedRoles Single role or array of roles that are allowed
 * @param redirectTo Optional redirect path for unauthorized users (default: /login)
 */
export async function requireRole(
  allowedRoles: MembershipRole | MembershipRole[],
  redirectTo: string = "/login"
): Promise<AuthSession> {
  const session = await requireAuth()
  
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  
  if (!roles.includes(session.role)) {
    // If user has a session but wrong role, redirect to dashboard instead of login
    if (redirectTo === "/login") {
      redirect("/dashboard")
    } else {
      redirect(redirectTo)
    }
  }
  
  return session
}

/**
 * Check if current user has any of the specified roles without redirecting
 */
export async function hasRole(allowedRoles: MembershipRole | MembershipRole[]): Promise<boolean> {
  const session = await getSession()
  
  if (!session) {
    return false
  }
  
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  return roles.includes(session.role)
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole("ADMIN")
}

/**
 * Check if current user is admin or manager
 */
export async function isManagerOrAbove(): Promise<boolean> {
  return hasRole(["ADMIN", "MANAGER"])
}

/**
 * Get user's company context for database queries
 */
export async function getCompanyContext(): Promise<{ companyId: string; userId: string } | null> {
  const session = await getSession()
  
  if (!session) {
    return null
  }
  
  return {
    companyId: session.companyId,
    userId: session.userId,
  }
}

/**
 * Require company context and throw if not available
 */
export async function requireCompanyContext(): Promise<{ companyId: string; userId: string }> {
  const context = await getCompanyContext()
  
  if (!context) {
    throw new Error("Company context required")
  }
  
  return context
}
