'use server';

import { revalidatePath } from 'next/cache';
import { createServerAction } from '@/lib/api-helpers';
import { z } from 'zod';

const createExpenseSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().min(1, 'Currency is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  paidBy: z.string().min(1, 'Paid by is required'),
  expenseDate: z.string().min(1, 'Expense date is required'),
  receiptFileKeys: z.string().optional()
});

export const createExpense = createServerAction({
  validationSchema: createExpenseSchema,
  action: async ({ tenant, session, validatedData }) => {
    const data = validatedData!;
    const { projectId, amount, currency, description, category, paidBy, expenseDate, receiptFileKeys } = data;

    // Validate amount
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return {
        success: false,
        error: 'Invalid amount'
      };
    }

    // Check if project exists and is active
    const project = await tenant.project.findUnique({
      where: { id: projectId }
    });

    if (!project || !project.active) {
      return {
        success: false,
        error: 'Project not found or inactive'
      };
    }

    // Check approval policy for limits
    const approvalPolicies = await tenant.approvalPolicy.findMany();
    const approvalPolicy = approvalPolicies[0] || null;
    if (approvalPolicy?.maxPerEmployeeMinor) {
      const maxAmount = Number(approvalPolicy.maxPerEmployeeMinor) / 100;
      if (amountNumber > maxAmount) {
        return {
          success: false,
          error: `Amount exceeds maximum per employee limit of $${maxAmount.toFixed(2)}`
        };
      }
    }

    // Convert amount to minor units (cents)
    const amountMinor = Math.round(amountNumber * 100);

    // Create expense
    const expense = await tenant.expense.create({
      data: {
        projectId,
        employeeId: session.userId,
        amountMinor: BigInt(amountMinor),
        currency,
        description,
        category,
        paidBy,
        expenseDate: new Date(expenseDate),
        status: 'PENDING'
      }
    });

    // Create receipt file records if files were uploaded
    if (receiptFileKeys) {
      try {
        const fileKeys = JSON.parse(receiptFileKeys) as string[];
        
        for (const key of fileKeys) {
          await tenant.raw.receiptFile.create({
            data: {
              expenseId: expense.id,
              url: key, // Store the S3 key as URL for now
              mime: 'application/octet-stream', // Will be updated when we fetch file metadata
              size: BigInt(0) // Will be updated when we fetch file metadata
            }
          });
        }
      } catch (error) {
        console.error('Error creating receipt file records:', error);
        // Don't fail the expense creation if receipt file creation fails
      }
    }

    return {
      success: true,
      data: { expenseId: expense.id }
    };
  }
});

export const updateExpense = createServerAction({
  validationSchema: createExpenseSchema.partial().extend({
    id: z.string().min(1, 'Expense ID is required')
  }),
  action: async ({ tenant, session, validatedData }) => {
    const data = validatedData!;
    const { id, ...updateData } = data;

    // Check if expense exists and belongs to the user
    const existingExpense = await tenant.expense.findUnique({
      where: { id }
    });

    if (!existingExpense || existingExpense.employeeId !== session.userId) {
      return {
        success: false,
        error: 'Expense not found or access denied'
      };
    }

    // Only allow updates to pending expenses
    if (existingExpense.status !== 'PENDING') {
      return {
        success: false,
        error: 'Cannot update non-pending expenses'
      };
    }

    // Prepare update data
    const updateFields: Record<string, unknown> = {};
    if (updateData.projectId) updateFields.projectId = updateData.projectId;
    if (updateData.description) updateFields.description = updateData.description;
    if (updateData.category) updateFields.category = updateData.category;
    if (updateData.paidBy) updateFields.paidBy = updateData.paidBy;
    if (updateData.expenseDate) updateFields.expenseDate = new Date(updateData.expenseDate);
    
    if (updateData.amount) {
      const amountNumber = parseFloat(updateData.amount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        return {
          success: false,
          error: 'Invalid amount'
        };
      }
      updateFields.amountMinor = BigInt(Math.round(amountNumber * 100));
    }

    if (updateData.currency) updateFields.currency = updateData.currency;

    // Update expense
    const updatedExpense = await tenant.expense.update({
      where: { id },
      data: updateFields
    });

    revalidatePath('/employee');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: { expense: updatedExpense }
    };
  }
});

export const deleteExpense = createServerAction({
  validationSchema: z.object({
    id: z.string().min(1, 'Expense ID is required')
  }),
  action: async ({ tenant, session, validatedData }) => {
    const data = validatedData!;
    const { id } = data;

    // Check if expense exists and belongs to the user
    const existingExpense = await tenant.expense.findUnique({
      where: { id }
    });

    if (!existingExpense || existingExpense.employeeId !== session.userId) {
      return {
        success: false,
        error: 'Expense not found or access denied'
      };
    }

    // Only allow deletion of pending expenses
    if (existingExpense.status !== 'PENDING') {
      return {
        success: false,
        error: 'Cannot delete non-pending expenses'
      };
    }

    // Delete expense
    await tenant.expense.delete({
      where: { id }
    });

    revalidatePath('/employee');
    revalidatePath('/dashboard');

    return {
      success: true
    };
  }
});
