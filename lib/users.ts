import { create } from "zustand";

import { ReadableUser } from "@/actions/user";

export interface UsersState {
  users: ReadableUser[];
  setUsers: (users: ReadableUser[]) => void;
}

// Global frontend cache of users, used to propagate users to other components.
export const useUsersStore = create<UsersState>()((set) => ({
  users: [] as ReadableUser[],
  setUsers: (users: ReadableUser[]) => set({ users }),
}));
