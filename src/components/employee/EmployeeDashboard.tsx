'use client';

import { useState, useEffect, useCallback } from 'react';
import { TenantPrisma } from '@/lib/tenant-guard';
import { Project, Expense, ApprovalPolicy } from '@prisma/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeExpenseForm } from './EmployeeExpenseForm';
import { EmployeeExpenseHistory } from './EmployeeExpenseHistory';

interface EmployeeDashboardProps {
  tenant: TenantPrisma;
}

interface DashboardData {
  projects: Project[];
  recentExpenses: (Expense & {
    project: Project;
    receiptFiles: Array<{
      id: string;
      url: string;
      mime: string;
      size: bigint;
    }>;
  })[];
  approvalPolicy: ApprovalPolicy | null;
}

export function EmployeeDashboard({ tenant }: EmployeeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [projects, recentExpenses, approvalPolicy] = await Promise.all([
        tenant.project.findMany({
          where: { active: true },
          orderBy: { name: 'asc' }
        }),
        tenant.raw.expense.findMany({
          where: { employeeId: tenant.getUserId() },
          include: { 
            project: true,
            receiptFiles: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        tenant.approvalPolicy.findMany().then(policies => policies[0] || null)
      ]);

      setDashboardData({
        projects,
        recentExpenses,
        approvalPolicy
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Dashboard</h1>
        <p className="text-gray-600">Manage your expenses and view your history</p>
      </div>

      <Tabs defaultValue="submit" className="space-y-6">
        <TabsList>
          <TabsTrigger value="submit">Submit Expense</TabsTrigger>
          <TabsTrigger value="history">My Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <EmployeeExpenseForm
            projects={dashboardData.projects}
            approvalPolicy={dashboardData.approvalPolicy}
            onExpenseSubmitted={loadDashboardData}
          />
        </TabsContent>

        <TabsContent value="history">
          <EmployeeExpenseHistory
            expenses={dashboardData.recentExpenses}
            onExpenseUpdated={loadDashboardData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
