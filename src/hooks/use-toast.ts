import React, { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Global toast state
let toasts: Toast[] = [];
const listeners: Set<() => void> = new Set();

const notify = () => {
  listeners.forEach(listener => listener());
};

export function useToast() {
  const [, forceUpdate] = useState({});

  const toast = useCallback(({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, title, description, variant };
    
    toasts = [...toasts, newToast];
    notify();
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      notify();
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, []);

  // Subscribe to changes
  React.useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    toast,
    dismiss,
    toasts
  };
}
