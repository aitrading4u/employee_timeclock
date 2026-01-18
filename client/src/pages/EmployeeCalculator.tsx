import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calculator } from "lucide-react";

export default function EmployeeCalculator() {
  const [, setLocation] = useLocation();
  const [hoursWorked, setHoursWorked] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  const total = useMemo(() => {
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
              <Calculator className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Calculadora</h1>
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
        <Card className="p-6 max-w-xl mx-auto space-y-6">
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
              Tarifa por hora
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
          <div className="p-4 rounded-lg border border-border bg-muted">
            <p className="text-sm text-muted-foreground">Total estimado</p>
            <p className="text-2xl font-semibold text-foreground">
              {total.toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Este cálculo es estimado y no reemplaza la nómina oficial.
          </p>
        </Card>
      </main>
    </div>
  );
}
