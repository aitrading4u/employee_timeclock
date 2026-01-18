import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function EmployeeIncident() {
  const [, setLocation] = useLocation();
  const [incidentType, setIncidentType] = useState("delay");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createIncident = trpc.publicApi.createIncident.useMutation();
  const clockIn = trpc.publicApi.clockIn.useMutation();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!incidentDate || !incidentTime || !description.trim()) {
      toast.error("Completa la fecha, hora y descripción");
      return;
    }

    setSubmitting(true);
    try {
      const username = localStorage.getItem("employeeUsername") || "";
      const password = localStorage.getItem("employeePassword") || "";
      const employeeId = Number(localStorage.getItem("employeeId"));
      await createIncident.mutateAsync({
        username,
        password,
        employeeId,
        type: incidentType === "delay" ? "late_arrival" : "other",
        reason: description.trim(),
      });

      if (incidentType === "delay") {
        const clockInDate = new Date(`${incidentDate}T${incidentTime}`);
        const locationRaw = localStorage.getItem("employeeLastLocation");
        const location = locationRaw ? JSON.parse(locationRaw) : null;
        if (location?.lat && location?.lng) {
          await clockIn.mutateAsync({
            username,
            password,
            employeeId,
            latitude: location.lat,
            longitude: location.lng,
          });
        } else {
          toast.error("No se pudo obtener tu ubicación para fichar la entrada");
        }
        localStorage.setItem("employeeClockedIn", "true");
        localStorage.setItem("employeeClockInTime", clockInDate.toISOString());
      }

      toast.success(
        incidentType === "delay"
          ? "Incidencia registrada y entrada fichada"
          : "Incidencia registrada correctamente"
      );
      setIncidentType("delay");
      setIncidentDate("");
      setIncidentTime("");
      setDescription("");
      setLocation("/employee");
    } catch (error) {
      toast.error("No se pudo enviar la incidencia");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <AlertCircle className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Reportar Incidencia</h1>
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
        <Card className="p-6 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tipo de incidencia
              </label>
              <select
                value={incidentType}
                onChange={(event) => setIncidentType(event.target.value)}
                className="input-elegant"
              >
                <option value="delay">Retraso</option>
                <option value="absence">No voy a trabajar</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(event) => setIncidentDate(event.target.value)}
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={incidentTime}
                  onChange={(event) => setIncidentTime(event.target.value)}
                  className="input-elegant"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input-elegant min-h-[120px]"
                placeholder="Describe brevemente lo ocurrido"
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-primary"
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar incidencia"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
