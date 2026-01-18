import { createContext, useContext, useMemo, useState } from "react";

type AdminAuth = {
  username: string;
  password: string;
};

type EmployeeScheduleDay = {
  entry1: string;
  entry2: string;
  isActive: boolean;
};

type EmployeeAuth = {
  username: string;
  password: string;
  employeeId: number;
  schedule?: Record<string, EmployeeScheduleDay>;
};

type AuthContextValue = {
  adminAuth: AdminAuth | null;
  employeeAuth: EmployeeAuth | null;
  lastLocation: { lat: number; lng: number } | null;
  setAdminAuth: (auth: AdminAuth | null) => void;
  setEmployeeAuth: (auth: EmployeeAuth | null) => void;
  setLastLocation: (location: { lat: number; lng: number } | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [adminAuth, setAdminAuth] = useState<AdminAuth | null>(null);
  const [employeeAuth, setEmployeeAuth] = useState<EmployeeAuth | null>(null);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);

  const value = useMemo(
    () => ({
      adminAuth,
      employeeAuth,
      lastLocation,
      setAdminAuth,
      setEmployeeAuth,
      setLastLocation,
    }),
    [adminAuth, employeeAuth, lastLocation]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
