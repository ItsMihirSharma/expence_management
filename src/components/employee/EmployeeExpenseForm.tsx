'use client';

import { useState, useRef } from 'react';
import { Project, ApprovalPolicy } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
// Removed unused server action import - using API call instead
import { Upload, FileText, X } from 'lucide-react';

interface EmployeeExpenseFormProps {
  projects: Project[];
  approvalPolicy: ApprovalPolicy | null;
  onExpenseSubmitted: () => void;
}

interface ReceiptFile {
  file: File;
  id: string;
  preview: string;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const CATEGORIES = [
  'Travel',
  'Meals',
  'Office Supplies',
  'Software',
  'Hardware',
  'Training',
  'Marketing',
  'Other'
];

const PAID_BY_OPTIONS = [
  'Company Card',
  'Personal Card',
  'Cash',
  'Bank Transfer'
];

export function EmployeeExpenseForm({ projects, approvalPolicy, onExpenseSubmitted }: EmployeeExpenseFormProps) {
  const [formData, setFormData] = useState({
    projectId: '',
    amount: '',
    currency: 'USD',
    description: '',
    category: '',
    paidBy: '',
    expenseDate: new Date().toISOString().split('T')[0]
  });
  const [receiptFiles, setReceiptFiles] = useState<ReceiptFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientValidation, setClientValidation] = useState<{
    isValid: boolean;
    message?: string;
  }>({ isValid: true });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const maxPerEmployee = approvalPolicy?.maxPerEmployeeMinor 
    ? Number(approvalPolicy.maxPerEmployeeMinor) / 100 
    : null;

  const validateAmount = (amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { isValid: false, message: 'Amount must be a positive number' };
    }
    
    if (maxPerEmployee && numAmount > maxPerEmployee) {
      return { 
        isValid: false, 
        message: `Amount exceeds maximum per employee limit of $${maxPerEmployee.toFixed(2)}` 
      };
    }
    
    return { isValid: true };
  };

  const handleInputChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    if (field === 'amount') {
      const validation = validateAmount(value);
      setClientValidation(validation);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 10MB`,
          variant: 'destructive'
        });
        return;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const preview = URL.createObjectURL(file);
      
      setReceiptFiles(prev => [...prev, { file, id, preview }]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeReceiptFile = (id: string) => {
    setReceiptFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const uploadFileToS3 = async (file: File): Promise<string> => {
    // Get presigned URL
    const presignedResponse = await fetch('/api/upload/presigned-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size
      })
    });

    if (!presignedResponse.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { data: presignedData } = await presignedResponse.json();

    // Upload file to S3
    const formData = new FormData();
    formData.append('key', presignedData.fields.key);
    formData.append('Content-Type', presignedData.fields['Content-Type']);
    formData.append('file', file);

    const uploadResponse = await fetch(presignedData.url, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return presignedData.fields.key;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!clientValidation.isValid) {
      toast({
        title: 'Validation Error',
        description: clientValidation.message,
        variant: 'destructive'
      });
      return;
    }

    if (!formData.projectId || !formData.amount || !formData.description || !formData.category || !formData.paidBy) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload receipt files first
      const uploadedFileKeys: string[] = [];
      for (const receiptFile of receiptFiles) {
        try {
          const key = await uploadFileToS3(receiptFile.file);
          uploadedFileKeys.push(key);
        } catch (error) {
          console.error('Failed to upload file:', receiptFile.file.name, error);
          toast({
            title: 'Upload Failed',
            description: `Failed to upload ${receiptFile.file.name}`,
            variant: 'destructive'
          });
          return;
        }
      }

      // Create expense with file keys
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('projectId', formData.projectId);
      formDataToSubmit.append('amount', formData.amount);
      formDataToSubmit.append('currency', formData.currency);
      formDataToSubmit.append('description', formData.description);
      formDataToSubmit.append('category', formData.category);
      formDataToSubmit.append('paidBy', formData.paidBy);
      formDataToSubmit.append('expenseDate', formData.expenseDate);
      formDataToSubmit.append('receiptFileKeys', JSON.stringify(uploadedFileKeys));

      const response = await fetch('/api/expenses', {
        method: 'POST',
        body: formDataToSubmit
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Expense Submitted',
          description: 'Your expense has been submitted for approval'
        });
        
        // Reset form
        setFormData({
          projectId: '',
          amount: '',
          currency: 'USD',
          description: '',
          category: '',
          paidBy: '',
          expenseDate: new Date().toISOString().split('T')[0]
        });
        setReceiptFiles([]);
        onExpenseSubmitted();
      } else {
        toast({
          title: 'Submission Failed',
          description: result.error || 'Failed to submit expense',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit New Expense</CardTitle>
        <CardDescription>
          Fill out the form below to submit a new expense for approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectId">Project *</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => handleInputChange('projectId', value)}
              >
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
              />
              {!clientValidation.isValid && (
                <Alert variant="destructive">
                  <AlertDescription>{clientValidation.message}</AlertDescription>
                </Alert>
              )}
              {maxPerEmployee && (
                <p className="text-sm text-gray-500">
                  Max per employee: ${maxPerEmployee.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidBy">Paid By *</Label>
              <Select
                value={formData.paidBy}
                onValueChange={(value) => handleInputChange('paidBy', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How was this paid?" />
                </SelectTrigger>
                <SelectContent>
                  {PAID_BY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseDate">Expense Date *</Label>
              <Input
                id="expenseDate"
                type="date"
                value={formData.expenseDate}
                onChange={(e) => handleInputChange('expenseDate', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe this expense..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Receipt Files</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mb-2"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Receipts
              </Button>
              <p className="text-sm text-gray-500">
                Upload images or PDFs (max 10MB each)
              </p>
            </div>

            {receiptFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Files:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {receiptFiles.map((receiptFile) => (
                    <div
                      key={receiptFile.id}
                      className="flex items-center space-x-2 p-2 border rounded"
                    >
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm flex-1 truncate">
                        {receiptFile.file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeReceiptFile(receiptFile.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !clientValidation.isValid}
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Expense'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
