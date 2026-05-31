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
  
  // Helper for UI routing guards. Any vault that survived BYOKSchema.safeParse is authenticated.
  isAuthenticated: () => {
    const vault = get().vault;
    if (!vault) return false;
    if (vault.isDemo === true) return true;
    return vault.isDemo === false; // apiKey format already enforced by BYOKSchema in setVault()
  }
}));
