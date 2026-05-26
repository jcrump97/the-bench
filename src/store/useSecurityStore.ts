import { create } from 'zustand';
import { BYOKSchema, type SecurityPayload } from '../schemas/gameSchemas';

interface SecurityState {
  vault: SecurityPayload | null;
  setVault: (payload: unknown) => void;
  clearVault: () => void;
  isAuthenticated: () => boolean;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  // Initialize empty vault
  vault: null,
  
  // Store only runtime-validated payload; fail closed on bad input
  setVault: (payload) => {
    const result = BYOKSchema.safeParse(payload);
    if (!result.success) {
      set({ vault: null });
      return;
    }
    set({ vault: result.data });
  },
  
  // Wipe the vault completely
  clearVault: () => set({ vault: null }),
  
  // Helper for UI routing guards
  isAuthenticated: () => {
    const currentVault = get().vault;
    if (!currentVault) return false;
    
    // The Demo Bypass
    if (currentVault.isDemo === true) return true;
    
    // The Live LLM Flow
    return currentVault.isDemo === false
      && currentVault.apiKey.length >= 30
      && currentVault.apiKey.startsWith('AIza');
  }
}));
