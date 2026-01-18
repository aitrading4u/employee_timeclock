import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
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
import AdminDashboard from "./pages/AdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/employee-login"} component={EmployeeLogin} />
      <Route path={"/admin-login"} component={AdminLogin} />
      <Route path={"/employee"} component={EmployeeDashboard} />
      <Route path={"/employee/calendar"} component={EmployeeCalendar} />
      <Route path={"/employee/calculator"} component={EmployeeCalculator} />
      <Route path={"/employee/incident"} component={EmployeeIncident} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
