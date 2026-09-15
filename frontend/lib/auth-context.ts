"use client";
import { createContext, useContext } from "react";
import type { UserResponse } from "@/types";
export const AuthContext = createContext<{
  user: UserResponse | null; isLoading: boolean; logout: () => Promise<void>;
}>({ user: null, isLoading: true, logout: async () => {} });
export function useAuth() { return useContext(AuthContext); }
