import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserSettings } from '@/types';
import { encryptToken, decryptToken } from '@/utils/tokenStorage';

interface AuthState {
  user: User | null;
  token: string | null;
  encryptedToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  persistToken: (token: string) => Promise<void>;
  restoreToken: () => Promise<string | null>;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      encryptedToken: null,
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: !!user,
          isLoading: false 
        });
      },
      
      setToken: (token) => {
        set({ token });
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      
      updateUserSettings: (settings) => set((state) => ({
        user: state.user 
          ? { ...state.user, settings: { ...state.user.settings, ...settings } }
          : null
      })),

      persistToken: async (token) => {
        try {
          const encrypted = await encryptToken(token);
          set({ encryptedToken: encrypted });
        } catch {
          set({ encryptedToken: null });
        }
      },

      restoreToken: async () => {
        const { encryptedToken } = get();
        if (!encryptedToken) return null;
        try {
          const plain = await decryptToken(encryptedToken);
          if (plain) {
            set({ token: plain });
          }
          return plain;
        } catch {
          set({ encryptedToken: null });
          return null;
        }
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          encryptedToken: null,
          isAuthenticated: false,
          isLoading: false
        });
      },

      initialize: () => {
        set({ isLoading: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        encryptedToken: state.encryptedToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
