import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Palmtree, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";

const kindLabels: Record<string, string> = {
  vacation: "Vacaciones",
  day_off: "Día libre",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Denegada",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: string }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

export default function EmployeeTimeOff() {
  const [, setLocation] = useLocation();
  const { employeeAuth } = useAuthContext();
  const [kind, setKind] = useState<"vacation" | "day_off">("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enabled = Boolean(
    employeeAuth?.username && employeeAuth?.password && employeeAuth?.employeeId
  );

  const listQuery = trpc.publicApi.listMyTimeOffRequests.useQuery(
    {
      username: employeeAuth?.username || "",
      password: employeeAuth?.password || "",
      employeeId: employeeAuth?.employeeId || 0,
    },
    { enabled }
  );

  const createMutation = trpc.publicApi.createTimeOffRequest.useMutation();
  const deleteMutation = trpc.publicApi.deleteMyTimeOffRequest.useMutation();

  useEffect(() => {
    if (!employeeAuth) {
      setLocation("/employee-login");
    }
  }, [employeeAuth, setLocation]);

  useEffect(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    const today = `${y}-${m}-${d}`;
    setStartDate(today);
    setEndDate(today);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeAuth) {
      toast.error("Inicia sesión");
      setLocation("/employee-login");
      return;
    }
    if (!comment.trim()) {
      toast.error("Debes escribir un comentario (motivo o detalles)");
      return;
    }
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        username: employeeAuth.username,
        password: employeeAuth.password,
        employeeId: employeeAuth.employeeId,
        kind,
        startDate,
        endDate,
        comment: comment.trim(),
      });
      toast.success("Solicitud enviada. El administrador la revisará.");
      setComment("");
      await listQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo enviar la solicitud"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!employeeAuth) return;
    const ok = window.confirm("¿Borrar esta solicitud pendiente? No podrás deshacerlo.");
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync({
        username: employeeAuth.username,
        password: employeeAuth.password,
        employeeId: employeeAuth.employeeId,
        requestId,
      });
      toast.success("Solicitud eliminada");
      await listQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo borrar la solicitud"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <Palmtree className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Vacaciones y días libres</h1>
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

      <main className="container py-8 max-w-2xl mx-auto space-y-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Nueva solicitud</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground">Tipo</Label>
              <select
                value={kind}
                onChange={(ev) => setKind(ev.target.value as "vacation" | "day_off")}
                className="input-elegant mt-2 w-full"
              >
                <option value="vacation">Vacaciones</option>
                <option value="day_off">Día(s) libre(s)</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Desde</Label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(ev) => setStartDate(ev.target.value)}
                  className="input-elegant mt-2 w-full"
                  required
                />
              </div>
              <div>
                <Label className="text-foreground">Hasta (incluido)</Label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(ev) => setEndDate(ev.target.value)}
                  className="input-elegant mt-2 w-full"
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Comentario (obligatorio)</Label>
              <Textarea
                value={comment}
                onChange={(ev) => setComment(ev.target.value)}
                placeholder="Motivo, notas para el administrador…"
                className="mt-2 min-h-[100px]"
                required
              />
            </div>
            <Button type="submit" className="w-full btn-primary" disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Mis solicitudes</h2>
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (listQuery.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay solicitudes.</p>
          ) : (
            <ul className="space-y-3">
              {(listQuery.data || []).map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border p-3 text-sm bg-muted/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {kindLabels[row.kind] ?? row.kind}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          row.status === "approved"
                            ? "text-green-600 dark:text-green-400"
                            : row.status === "rejected"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                        }
                      >
                        {statusLabels[row.status] ?? row.status}
                      </span>
                      {row.status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDeleteRequest(row.id)}
                          title="Borrar solicitud"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {String(row.startDate)} → {String(row.endDate)}
                  </p>
                  <p className="mt-2 text-foreground whitespace-pre-wrap">{row.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
