import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const createCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  adminName: z.string().min(1, "Admin name is required"),
  adminEmail: z.string().email("Valid email is required"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createCompanySchema.parse(body)

    const { companyName, adminName, adminEmail, adminPassword } = validatedData

    // Check if company with this name already exists
    const existingCompany = await prisma.company.findFirst({
      where: { name: companyName }
    })

    if (existingCompany) {
      return NextResponse.json(
        { error: "A company with this name already exists" },
        { status: 400 }
      )
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      )
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(adminPassword, 12)

    // Create company and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the company
      const company = await tx.company.create({
        data: {
          name: companyName,
          baseCurrency: "USD",
        }
      })

      // Create the admin user
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash,
        }
      })

      // Create admin membership
      await tx.membership.create({
        data: {
          userId: adminUser.id,
          companyId: company.id,
          role: "ADMIN",
        }
      })

      // Create default approval policy
      await tx.approvalPolicy.create({
        data: {
          companyId: company.id,
          type: "PERCENTAGE",
          thresholdPercent: 50,
          maxPerEmployeeMinor: BigInt(100000), // $1000
          largeExpenseThresholdMinor: BigInt(500000), // $5000
          requireCeoForLarge: false,
        }
      })

      return { company, adminUser }
    })

    return NextResponse.json({
      success: true,
      data: {
        companyId: result.company.id,
        companyName: result.company.name,
        adminEmail: result.adminUser.email,
        message: "Company created successfully"
      }
    })

  } catch (error) {
    console.error("Company creation error:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    )
  }
}

