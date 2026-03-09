import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface UIState {
  toasts: Toast[];
  isModalOpen: boolean;
  modalContent: React.ReactNode | null;
  isSidebarOpen: boolean;
  
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  isModalOpen: false,
  modalContent: null,
  isSidebarOpen: false,
  
  addToast: (toast) => {
    const id = generateId();
    const newToast = { ...toast, id };
    
    set((state) => ({
      toasts: [...state.toasts, newToast]
    }));
    
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  })),
  
  clearToasts: () => set({ toasts: [] }),
  
  openModal: (modalContent) => set({
    isModalOpen: true,
    modalContent
  }),
  
  closeModal: () => set({
    isModalOpen: false,
    modalContent: null
  }),
  
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  
  toggleSidebar: () => set((state) => ({
    isSidebarOpen: !state.isSidebarOpen
  }))
}));
