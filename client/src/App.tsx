import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import EmployeeLogin from "./pages/EmployeeLogin";
import AdminLogin from "./pages/AdminLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeIncident from "./pages/EmployeeIncident";
import EmployeeCalendar from "./pages/EmployeeCalendar";
import EmployeeCalculator from "./pages/EmployeeCalculator";
import EmployeeSchedule from "./pages/EmployeeSchedule";
import AdminDashboard from "./pages/AdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/employee-login"} component={EmployeeLogin} />
      <Route path={"/admin-login"} component={AdminLogin} />
      <Route path={"/employee"} component={EmployeeDashboard} />
      <Route path={"/employee/calendar"} component={EmployeeCalendar} />
      <Route path={"/employee/schedule"} component={EmployeeSchedule} />
      <Route path={"/employee/calculator"} component={EmployeeCalculator} />
      <Route path={"/employee/incident"} component={EmployeeIncident} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function UpdateAppButton() {
  const [showUpdateButton, setShowUpdateButton] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const onUpdateAvailable = () => setShowUpdateButton(true);
    window.addEventListener("timeclock-update-available", onUpdateAvailable);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
          setShowUpdateButton(true);
        }
      });
    }

    return () => {
      window.removeEventListener("timeclock-update-available", onUpdateAvailable);
    };
  }, []);

  const handleRefreshApp = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }
        await registration?.update();
      }
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!showUpdateButton) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button onClick={handleRefreshApp} className="shadow-lg" disabled={isRefreshing}>
        <RefreshCw className="w-4 h-4 mr-2" />
        {isRefreshing ? "Actualizando..." : "Actualizar app"}
      </Button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <UpdateAppButton />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
