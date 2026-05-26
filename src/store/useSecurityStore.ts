import { create } from 'zustand';
import { SecurityPayload } from '../schemas/gameSchemas';

interface SecurityState {
  vault: SecurityPayload | null;
  setVault: (payload: SecurityPayload) => void;
  clearVault: () => void;
  isAuthenticated: () => boolean;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  // Initialize empty vault
  vault: null,
  
  // Store the strictly validated payload (either Demo or API Key)
  setVault: (payload) => set({ vault: payload }),
  
  // Wipe the vault completely
  clearVault: () => set({ vault: null }),
  
  // Helper for UI routing guards
  isAuthenticated: () => {
    const currentVault = get().vault;
    if (!currentVault) return false;
    
    // The Demo Bypass
    if (currentVault.isDemo) return true;
    
    // The Live LLM Flow
    return !!currentVault.apiKey;
  }
}));
