import { Calendar, CalendarDays, Palmtree } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { key: "timeoff", label: "Vacaciones", path: "/employee/time-off", icon: Palmtree },
  { key: "calendar", label: "Calendario", path: "/employee/calendar", icon: Calendar },
  { key: "schedule", label: "Horario", path: "/employee/schedule", icon: CalendarDays },
] as const;

export default function EmployeeBottomMenu() {
  const [location, setLocation] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="container py-2 grid grid-cols-3 gap-2">
        {items.map((item) => {
          const active = location === item.path;
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              type="button"
              variant="ghost"
              className={cn(
                "h-14 flex flex-col items-center justify-center gap-1 text-xs",
                active && "bg-accent text-accent-foreground"
              )}
              onClick={() => setLocation(item.path)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
