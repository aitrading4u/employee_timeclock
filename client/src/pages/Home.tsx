import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Clock, Users, AlertCircle } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    // Redirect based on role
    if (user.role === 'admin') {
      setLocation('/admin');
    } else {
      setLocation('/employee');
    }
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-6 shadow-lg">
            <Clock className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">TimeClock</h1>
          <p className="text-muted-foreground text-lg">Sistema de Fichaje de Empleados</p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-12">
          <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
            <Clock className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Fichaje Inteligente</h3>
              <p className="text-sm text-muted-foreground">Validación por ubicación GPS</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
            <Users className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Gestión Completa</h3>
              <p className="text-sm text-muted-foreground">Panel de administrador avanzado</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Incidencias</h3>
              <p className="text-sm text-muted-foreground">Registro de retrasos y eventos</p>
            </div>
          </div>
        </div>

        {/* Login Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => setLocation('/employee-login')}
            className="w-full btn-primary text-base"
          >
            Acceso Empleado
          </Button>
          <Button
            onClick={() => setLocation('/admin-login')}
            variant="outline"
            className="w-full text-base"
          >
            Acceso Administrador
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2024 TimeClock. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
