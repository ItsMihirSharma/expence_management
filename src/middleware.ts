import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl
    
    // If user is authenticated, check role-based access
    if (token) {
      const userRole = token.role as "ADMIN" | "MANAGER" | "EMPLOYEE"
      
      // Admin-only routes
      if (pathname.startsWith("/admin")) {
        if (userRole !== "ADMIN") {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }
      
      // Manager+ routes (Admin or Manager)
      if (pathname.startsWith("/manage") || pathname.startsWith("/reports") || pathname.startsWith("/manager")) {
        if (!["ADMIN", "MANAGER"].includes(userRole)) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }
      
      // Employee routes - all authenticated users can access
      if (pathname.startsWith("/expenses") || pathname.startsWith("/employee") || pathname.startsWith("/profile")) {
        // All authenticated users can access these
      }
      
      // Redirect authenticated users away from login page
      if (pathname === "/login") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    }
    
    // Continue to the requested page
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Always allow access to public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/login") || 
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/company/create") ||
          pathname.startsWith("/_next") ||
          pathname === "/favicon.ico"
        ) {
          return true
        }
        
        // All other routes require authentication
        if (
          pathname.startsWith("/dashboard") ||
          pathname.startsWith("/admin") ||
          pathname.startsWith("/manage") ||
          pathname.startsWith("/reports") ||
          pathname.startsWith("/expenses") ||
          pathname.startsWith("/employee") ||
          pathname.startsWith("/profile") ||
          pathname.startsWith("/api/")
        ) {
          return !!token
        }
        
        // Default: require authentication for unmatched routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
