import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  lateGraceMinutes?: number;
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
  const [adminAuth, setAdminAuth] = useState<AdminAuth | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("timeclock.adminAuth");
      return raw ? (JSON.parse(raw) as AdminAuth) : null;
    } catch (error) {
      console.warn("No se pudo leer adminAuth guardado", error);
      return null;
    }
  });
  const [employeeAuth, setEmployeeAuth] = useState<EmployeeAuth | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("timeclock.employeeAuth");
      return raw ? (JSON.parse(raw) as EmployeeAuth) : null;
    } catch (error) {
      console.warn("No se pudo leer employeeAuth guardado", error);
      return null;
    }
  });
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("timeclock.lastLocation");
      return raw ? (JSON.parse(raw) as { lat: number; lng: number }) : null;
    } catch (error) {
      console.warn("No se pudo leer lastLocation guardado", error);
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (adminAuth) {
      window.localStorage.setItem("timeclock.adminAuth", JSON.stringify(adminAuth));
    } else {
      window.localStorage.removeItem("timeclock.adminAuth");
    }
  }, [adminAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (employeeAuth) {
      window.localStorage.setItem("timeclock.employeeAuth", JSON.stringify(employeeAuth));
    } else {
      window.localStorage.removeItem("timeclock.employeeAuth");
    }
  }, [employeeAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastLocation) {
      window.localStorage.setItem("timeclock.lastLocation", JSON.stringify(lastLocation));
    } else {
      window.localStorage.removeItem("timeclock.lastLocation");
    }
  }, [lastLocation]);

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
