import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create a company
  const company = await prisma.company.create({
    data: {
      name: 'TechCorp Inc.',
      baseCurrency: 'USD',
    },
  })

  console.log('✅ Created company:', company.name)

  // Create users
  const adminPassword = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@techcorp.com' },
    update: {},
    create: {
      email: 'admin@techcorp.com',
      name: 'Alice Admin',
      passwordHash: adminPassword,
    },
  })

  const managerPassword = await hash('manager123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@techcorp.com' },
    update: {},
    create: {
      email: 'manager@techcorp.com',
      name: 'Bob Manager',
      passwordHash: managerPassword,
    },
  })

  const employeePassword = await hash('employee123', 12)
  const employee = await prisma.user.upsert({
    where: { email: 'employee@techcorp.com' },
    update: {},
    create: {
      email: 'employee@techcorp.com',
      name: 'Charlie Employee',
      passwordHash: employeePassword,
    },
  })

  console.log('✅ Created users: Admin, Manager, Employee')

  // Create memberships (user-company relationships with roles)
  const adminMembership = await prisma.membership.upsert({
    where: {
      userId_companyId: {
        userId: admin.id,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      companyId: company.id,
      role: 'ADMIN',
    },
  })

  const managerMembership = await prisma.membership.upsert({
    where: {
      userId_companyId: {
        userId: manager.id,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      companyId: company.id,
      role: 'MANAGER',
    },
  })

  const employeeMembership = await prisma.membership.upsert({
    where: {
      userId_companyId: {
        userId: employee.id,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId: employee.id,
      companyId: company.id,
      role: 'EMPLOYEE',
    },
  })

  console.log('✅ Created memberships with roles')

  // Create a project
  const project = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Website Redesign',
      description: 'Complete overhaul of company website with modern UI/UX',
      active: true,
    },
  })

  console.log('✅ Created project:', project.name)

  // Create an approval policy
  const approvalPolicy = await prisma.approvalPolicy.create({
    data: {
      companyId: company.id,
      type: 'MAJORITY',
      maxPerEmployeeMinor: BigInt(100000), // $1,000.00 in minor units
      largeExpenseThresholdMinor: BigInt(500000), // $5,000.00 in minor units
      requireCeoForLarge: true,
    },
  })

  console.log('✅ Created approval policy')

  // Create sample exchange rate snapshot
  const exchangeRateSnapshot = await prisma.exchangeRateSnapshot.create({
    data: {
      companyId: company.id,
      baseCurrency: 'USD',
      rates: {
        EUR: 0.85,
        GBP: 0.73,
        JPY: 110.25,
        CAD: 1.25,
        AUD: 1.35,
      },
    },
  })

  console.log('✅ Created exchange rate snapshot')

  // Create a sample expense
  const expense = await prisma.expense.create({
    data: {
      projectId: project.id,
      employeeId: employee.id,
      amountMinor: BigInt(4500), // $45.00 in minor units
      currency: 'USD',
      description: 'Client dinner meeting at restaurant',
      category: 'Meals & Entertainment',
      paidBy: 'Employee Credit Card',
      expenseDate: new Date('2024-10-01'),
      status: 'PENDING',
    },
  })

  console.log('✅ Created sample expense: $45.00 for client dinner')

  // Create a receipt file entry (simulated)
  const receiptFile = await prisma.receiptFile.create({
    data: {
      expenseId: expense.id,
      url: 'https://example.com/receipts/dinner-receipt-001.jpg',
      mime: 'image/jpeg',
      size: BigInt(245760), // ~240KB
    },
  })

  console.log('✅ Created receipt file reference')

  // Create an audit log entry
  const auditLog = await prisma.auditLog.create({
    data: {
      companyId: company.id,
      actorUserId: employee.id,
      action: 'CREATE_EXPENSE',
      entity: 'Expense',
      entityId: expense.id,
      meta: {
        amount: 45.00,
        currency: 'USD',
        category: 'Meals & Entertainment',
        projectName: project.name,
      },
    },
  })

  console.log('✅ Created audit log entry')

  // Summary
  console.log('\n🎉 Database seed completed successfully!')
  console.log('\n📊 Created:')
  console.log(`  - 1 Company: ${company.name}`)
  console.log(`  - 3 Users: Admin, Manager, Employee`)
  console.log(`  - 3 Memberships with different roles`)
  console.log(`  - 1 Project: ${project.name}`)
  console.log(`  - 1 Sample Expense: $45.00`)
  console.log(`  - 1 Receipt File`)
  console.log(`  - 1 Approval Policy`)
  console.log(`  - 1 Exchange Rate Snapshot`)
  console.log(`  - 1 Audit Log Entry`)
  
  console.log('\n🔑 Test Credentials:')
  console.log('  Admin:    admin@techcorp.com    / admin123')
  console.log('  Manager:  manager@techcorp.com  / manager123')
  console.log('  Employee: employee@techcorp.com / employee123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
