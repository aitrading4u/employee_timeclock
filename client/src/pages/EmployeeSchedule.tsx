import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";

const scheduleDays = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
] as const;

type DaySchedule = {
  entry1: string;
  entry2: string;
  isActive: boolean;
};

function getShiftLabel(daySchedule?: DaySchedule): string {
  if (!daySchedule || !daySchedule.isActive) return "Día libre";
  if (daySchedule.entry1 && daySchedule.entry2) return "Turno Partido";
  if (!daySchedule.entry1) return "Día libre";

  const hour = Number(daySchedule.entry1.split(":")[0] || "0");
  return hour >= 14 ? "Tarde" : "Mañana";
}

export default function EmployeeSchedule() {
  const [, setLocation] = useLocation();
  const { employeeAuth } = useAuthContext();

  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    {
      username: employeeAuth?.username || "",
      password: employeeAuth?.password || "",
      employeeId: employeeAuth?.employeeId || 0,
    },
    { enabled: Boolean(employeeAuth?.username && employeeAuth?.password && employeeAuth?.employeeId) }
  );

  const normalizedSchedule = useMemo(() => {
    return scheduleDays.map((day) => {
      const value = (employeeScheduleQuery.data?.[day.key] || {
        entry1: "",
        entry2: "",
        isActive: false,
      }) as DaySchedule;
      return {
        ...day,
        value,
      };
    });
  }, [employeeScheduleQuery.data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <CalendarDays className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Horario</h1>
          </div>
          <Button onClick={() => setLocation("/employee")} variant="ghost" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Calendario semanal de turnos</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Tu administrador configura estos turnos. Aquí puedes ver tu planificación por día.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {normalizedSchedule.map((day) => (
              <div key={day.key} className="border border-border rounded-lg p-4 bg-card">
                <p className="font-semibold text-foreground">{day.label}</p>
                <p className="text-sm mt-2 text-foreground">{getShiftLabel(day.value)}</p>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
