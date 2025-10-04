import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection
    const userCount = await prisma.user.count()
    return NextResponse.json({ 
      message: 'API working', 
      userCount,
      env: {
        databaseUrl: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
        nextAuthUrl: process.env.NEXTAUTH_URL ? '✓ Set' : '✗ Missing',
        nextAuthSecret: process.env.NEXTAUTH_SECRET ? '✓ Set' : '✗ Missing',
      }
    })
  } catch (error) {
    console.error('API Test Error:', error)
    return NextResponse.json({ 
      error: 'Failed to connect to database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
