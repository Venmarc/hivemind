import { create } from 'zustand';

export interface HiveUser {
  id: string;
  name: string;
  vote: string | null;
  isHost?: boolean;
  initials?: string;
}

interface HiveState {
  users: HiveUser[];
  consensus: string | null;
  setUsers: (users: HiveUser[]) => void;
  setConsensus: (choice: string | null) => void;
  reset: () => void;
}

export const useHiveStore = create<HiveState>((set) => ({
  users: [],
  consensus: null,
  setUsers: (users) => set({ users }),
  setConsensus: (choice) => set({ consensus: choice }),
  reset: () => set({ users: [], consensus: null }),
}));