'use client';

import { useState } from 'react';
import { Expense, Project } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface EmployeeExpenseHistoryProps {
  expenses: (Expense & {
    project: Project;
    receiptFiles: Array<{
      id: string;
      url: string;
      mime: string;
      size: bigint;
    }>;
  })[];
  onExpenseUpdated: () => void;
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  ESCALATED: 'bg-blue-100 text-blue-800'
};

export function EmployeeExpenseHistory({ expenses }: EmployeeExpenseHistoryProps) {
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });

  const filteredExpenses = expenses.filter(expense => {
    const matchesStatus = !filters.status || expense.status === filters.status;
    const matchesSearch = !filters.search || 
      expense.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      expense.category.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const formatAmount = (amountMinor: bigint, currency: string) => {
    const amount = Number(amountMinor) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Expenses</CardTitle>
        <CardDescription>
          View and track your submitted expenses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search expenses..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ESCALATED">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipts</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.expenseDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{expense.project.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={expense.description}>
                          {expense.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(expense.amountMinor, expense.currency)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(expense.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-500">
                            {expense.receiptFiles?.length || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          {filteredExpenses.length > 0 && (
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>
                Showing {filteredExpenses.length} of {expenses.length} expenses
              </span>
              <span>
                Total: {formatAmount(
                  BigInt(filteredExpenses.reduce((sum, expense) => sum + Number(expense.amountMinor), 0)),
                  filteredExpenses[0]?.currency || 'USD'
                )}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
