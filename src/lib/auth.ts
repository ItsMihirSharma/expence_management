import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      companyId: string
      role: "ADMIN" | "MANAGER" | "EMPLOYEE"
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    companyId: string
    role: "ADMIN" | "MANAGER" | "EMPLOYEE"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    companyId: string
    role: "ADMIN" | "MANAGER" | "EMPLOYEE"
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Find user by email and include memberships with company information
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { 
            memberships: {
              include: {
                company: true
              }
            }
          },
        })

        if (!user) {
          return null
        }

        // Verify password
        const isPasswordValid = await compare(credentials.password, user.passwordHash)
        
        if (!isPasswordValid) {
          return null
        }

        // Get the first membership (for simplicity, in a real app you might handle multiple memberships)
        const primaryMembership = user.memberships[0]
        
        if (!primaryMembership) {
          return null // User has no company membership
        }

        // Return user object that matches our extended User type
        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          companyId: primaryMembership.companyId,
          role: primaryMembership.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.companyId = user.companyId
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.userId,
          email: token.email!,
          name: token.name || undefined,
          companyId: token.companyId,
          role: token.role,
        }
      }
      return session
    },
  },
}
