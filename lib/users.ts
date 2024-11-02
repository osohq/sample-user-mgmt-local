import { create } from "zustand";

import { User } from "@/lib/relations";

export interface UsersState {
  users: User[];
  setUsers: (users: User[]) => void;
}

// Global frontend cache of users, used to propagate users to other components.
export const useUsersStore = create<UsersState>()((set) => ({
  users: [] as User[],
  setUsers: (users: User[]) => set({ users }),
}));
