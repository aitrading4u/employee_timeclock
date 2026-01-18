import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format } from "date-fns";
import { useMemo } from "react";

export default function EmployeeCalendar() {
  const [, setLocation] = useLocation();
  const [selectionMode, setSelectionMode] = useState<"single" | "range">("single");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedRange, setSelectedRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [hoursWorked, setHoursWorked] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  const salaryTotal = useMemo(() => {
    const hours = Number(hoursWorked);
    const rate = Number(hourlyRate);
    if (Number.isNaN(hours) || Number.isNaN(rate)) return 0;
    return Math.max(hours, 0) * Math.max(rate, 0);
  }, [hoursWorked, hourlyRate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <CalendarIcon className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Calendario</h1>
          </div>
          <Button
            onClick={() => setLocation("/employee")}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <Card className="p-6 max-w-3xl mx-auto">
          <div className="grid gap-6 md:grid-cols-[auto,1fr] items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedDate(prev => (prev ? addDays(prev, -1) : new Date()))
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center text-sm font-medium text-foreground">
                  {selectionMode === "range"
                    ? selectedRange?.from && selectedRange?.to
                      ? `${format(selectedRange.from, "d MMM yyyy")} - ${format(selectedRange.to, "d MMM yyyy")}`
                      : "Selecciona un rango"
                    : selectedDate
                    ? format(selectedDate, "eeee, d MMMM yyyy")
                    : "Selecciona un día"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedDate(prev => (prev ? addDays(prev, 1) : new Date()))
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectionMode("single")}
                  className={`px-4 py-2 text-sm font-medium ${
                    selectionMode === "single"
                      ? "bg-accent text-accent-foreground"
                      : "bg-transparent text-foreground hover:bg-muted"
                  }`}
                >
                  Un día
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("range")}
                  className={`px-4 py-2 text-sm font-medium ${
                    selectionMode === "range"
                      ? "bg-accent text-accent-foreground"
                      : "bg-transparent text-foreground hover:bg-muted"
                  }`}
                >
                  Rango de días
                </button>
              </div>
              {selectionMode === "range" ? (
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={setSelectedRange}
                />
              ) : (
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
              )}
            </div>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                {selectionMode === "range" ? "Detalle del rango" : "Detalle del día"}
              </h2>
              <div className="p-4 rounded-lg border border-border bg-muted">
                <p className="text-sm text-muted-foreground">
                  {selectionMode === "range"
                    ? selectedRange?.from && selectedRange?.to
                      ? `${selectedRange.from.toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                        })} - ${selectedRange.to.toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}`
                      : "Selecciona un rango para ver el detalle."
                    : selectedDate
                    ? selectedDate.toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Selecciona un día para ver el detalle."}
                </p>
                <p className="mt-3 text-sm text-foreground">
                  Horas registradas: 0h
                </p>
                <p className="text-sm text-foreground">Incidencias: 0</p>
              </div>
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Calculadora de sueldo
                </h3>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Horas trabajadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={hoursWorked}
                    onChange={(event) => setHoursWorked(event.target.value)}
                    className="input-elegant"
                    placeholder="Ej. 160"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Sueldo por hora
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                    className="input-elegant"
                    placeholder="Ej. 12.50"
                  />
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted">
                  <p className="text-sm text-muted-foreground">Total estimado</p>
                  <p className="text-lg font-semibold text-foreground">
                    {salaryTotal.toLocaleString("es-ES", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Próximamente verás aquí tus fichajes e incidencias por día.
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
