import { create } from 'zustand';
import type { ToastType } from '../components/ui/Toast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

/** Convenience hooks */
export const useToast = () => {
  const addToast = useToastStore((s) => s.addToast);
  return {
    showError: (msg: string) => addToast(msg, 'error'),
    showSuccess: (msg: string) => addToast(msg, 'success'),
    showInfo: (msg: string) => addToast(msg, 'info'),
  };
};
