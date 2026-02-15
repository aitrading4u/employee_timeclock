import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, LogOut, Calendar, Calculator, AlertCircle, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';

const LATE_CUTOFF_HOUR = 9;
const LATE_CUTOFF_MINUTE = 0;
const LATE_GRACE_MINUTES = 5;

const weekdayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export default function EmployeeDashboard() {
  const clockInMutation = trpc.publicApi.clockIn.useMutation();
  const clockOutMutation = trpc.publicApi.clockOut.useMutation();
  const subscribePushMutation = trpc.publicApi.pushNotifications.subscribe.useMutation();
  const vapidKeyQuery = trpc.publicApi.pushNotifications.getVapidPublicKey.useQuery();
  const [, setLocation] = useLocation();
  const { employeeAuth, setEmployeeAuth, setLastLocation } = useAuthContext();
  const [location, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isAtRestaurant, setIsAtRestaurant] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLate, setIsLate] = useState(false);
  const [isWorkDay, setIsWorkDay] = useState(true);
  const [lastClockOut, setLastClockOut] = useState<Date | null>(null);
  const notificationWarningShown = useRef(false);

  const employeeTimeclocks = trpc.publicApi.getEmployeeTimeclocks.useQuery(
    {
      username: employeeAuth?.username || "",
      password: employeeAuth?.password || "",
      employeeId: employeeAuth?.employeeId || 0,
    },
    { enabled: Boolean(employeeAuth?.username && employeeAuth?.password && employeeAuth?.employeeId) }
  );
  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    {
      username: employeeAuth?.username || "",
      password: employeeAuth?.password || "",
      employeeId: employeeAuth?.employeeId || 0,
    },
    { enabled: Boolean(employeeAuth?.username && employeeAuth?.password && employeeAuth?.employeeId) }
  );
  const employeeRestaurantQuery = trpc.publicApi.getEmployeeRestaurant.useQuery(
    {
      username: employeeAuth?.username || "",
      password: employeeAuth?.password || "",
      employeeId: employeeAuth?.employeeId || 0,
    },
    { enabled: Boolean(employeeAuth?.username && employeeAuth?.password && employeeAuth?.employeeId) }
  );

  useEffect(() => {
    if (!employeeAuth) {
      setLocation('/employee-login');
    }
  }, [employeeAuth, setLocation]);

  // Request push notification permission and subscribe
  useEffect(() => {
    if (!employeeAuth || !vapidKeyQuery.data?.publicKey) return;

    const subscribeToPushNotifications = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications are not supported');
        return;
      }

      try {
        // Check if already subscribed
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        
        if (existingSubscription) {
          // Already subscribed, update if needed
          return;
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }

        // Convert VAPID key from base64url to Uint8Array
        const vapidPublicKey = vapidKeyQuery.data.publicKey;
        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        // Convert keys to base64url format
        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        
        const base64UrlEncode = (arrayBuffer: ArrayBuffer): string => {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        };

        // Send subscription to server
        await subscribePushMutation.mutateAsync({
          username: employeeAuth.username,
          password: employeeAuth.password,
          employeeId: employeeAuth.employeeId,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: base64UrlEncode(p256dhKey!),
              auth: base64UrlEncode(authKey!),
            },
          },
        });

        console.log('Push notification subscription successful');
      } catch (error) {
        console.error('Error subscribing to push notifications:', error);
      }
    };

    subscribeToPushNotifications();
  }, [employeeAuth, vapidKeyQuery.data, subscribePushMutation]);

  useEffect(() => {
    if (!employeeAuth || !vapidKeyQuery.isSuccess) return;
    if (!vapidKeyQuery.data?.publicKey && !notificationWarningShown.current) {
      notificationWarningShown.current = true;
      toast.error("Notificaciones no configuradas. Contacta con el administrador.");
    }
  }, [employeeAuth, vapidKeyQuery.isSuccess, vapidKeyQuery.data]);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timeclocks = employeeTimeclocks.data || [];
    const openRecord = timeclocks.find((entry) => entry.entryTime && !entry.exitTime);
    setIsClockedIn(Boolean(openRecord));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayExit = timeclocks
      .filter((entry) => {
        const entryDate = new Date(entry.createdAt);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === today.getTime() && entry.exitTime;
      })
      .sort((a, b) => new Date(b.exitTime || 0).getTime() - new Date(a.exitTime || 0).getTime())[0];
    setLastClockOut(todayExit?.exitTime ? new Date(todayExit.exitTime) : null);
  }, [employeeTimeclocks.data]);

  useEffect(() => {
    if (isClockedIn) {
      setIsLate(false);
      return;
    }

    const scheduleKey = weekdayKeys[currentTime.getDay()];
    const daySchedule =
      employeeScheduleQuery.data?.[scheduleKey] ?? employeeAuth?.schedule?.[scheduleKey];
    const entry1 = daySchedule?.entry1 || null;
    const entry2 = daySchedule?.entry2 || null;
    const dayActive = daySchedule?.isActive ?? true;
    const isSameDayClockOut =
      lastClockOut &&
      lastClockOut.getFullYear() === currentTime.getFullYear() &&
      lastClockOut.getMonth() === currentTime.getMonth() &&
      lastClockOut.getDate() === currentTime.getDate();

    setIsWorkDay(dayActive);
    if (!dayActive) {
      setIsLate(false);
      return;
    }

    const entryTime = isSameDayClockOut && entry2 ? entry2 : entry1;

    let cutoffHour = LATE_CUTOFF_HOUR;
    let cutoffMinute = LATE_CUTOFF_MINUTE;

    if (!entryTime) {
      setIsLate(false);
      return;
    }

    if (typeof entryTime === "string") {
      const normalized = entryTime.replace(".", ":").trim();
      if (normalized.includes(":")) {
        const [hourStr, minuteStr] = normalized.split(":");
        cutoffHour = Number(hourStr);
        cutoffMinute = Number(minuteStr || "0");
      } else if (normalized.length > 0) {
        cutoffHour = Number(normalized);
        cutoffMinute = 0;
      }
    }

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const graceMinutes = employeeAuth?.lateGraceMinutes ?? LATE_GRACE_MINUTES;
    const cutoffTotalMinutes = cutoffHour * 60 + cutoffMinute + graceMinutes;
    const currentTotalMinutes = hours * 60 + minutes;
    const isAfterCutoff = currentTotalMinutes > cutoffTotalMinutes;

    setIsLate(isAfterCutoff);
  }, [
    currentTime,
    isClockedIn,
    employeeAuth?.schedule,
    employeeScheduleQuery.data,
    lastClockOut,
  ]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLastLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          toast.error('No se pudo obtener tu ubicación');
          console.error(error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!location) {
      setIsAtRestaurant(false);
      return;
    }
    const restaurant = employeeRestaurantQuery.data;
    if (!restaurant) {
      setIsAtRestaurant(false);
      return;
    }
    const distance = calculateDistance(
      Number(restaurant.latitude),
      Number(restaurant.longitude),
      location.lat,
      location.lng
    );
    setIsAtRestaurant(distance <= restaurant.radiusMeters);
  }, [location, employeeRestaurantQuery.data]);

  const handleClockIn = async () => {
    if (!location) {
      toast.error('No se pudo obtener tu ubicación');
      return;
    }

    setLoading(true);
    try {
      await clockInMutation.mutateAsync({
        username: employeeAuth?.username || "",
        password: employeeAuth?.password || "",
        employeeId: employeeAuth?.employeeId || 0,
        latitude: location.lat,
        longitude: location.lng,
      });
      setIsClockedIn(true);
      toast.success('¡Entrada registrada!');
    } catch (error) {
      toast.error('Error al registrar entrada');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!location) {
      toast.error('No se pudo obtener tu ubicación');
      return;
    }

    setLoading(true);
    try {
      await clockOutMutation.mutateAsync({
        username: employeeAuth?.username || "",
        password: employeeAuth?.password || "",
        employeeId: employeeAuth?.employeeId || 0,
        latitude: location.lat,
        longitude: location.lng,
      });
      setIsClockedIn(false);
      toast.success('¡Salida registrada!');
    } catch (error) {
      toast.error('Error al registrar salida');
    } finally {
      setLoading(false);
    }
  };

  const handleIncident = () => {
    setLocation('/employee/incident');
  };

  const handleLogout = () => {
    setEmployeeAuth(null);
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <Clock className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">TimeClock</h1>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Time Display */}
        <div className="mb-8 text-center">
          <div className="text-5xl font-bold text-foreground mb-2">
            {currentTime.toLocaleTimeString('es-ES')}
          </div>
          <div className="text-lg text-muted-foreground">
            {currentTime.toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        {/* Location Status */}
        <Card className="mb-8 p-6 border-2 border-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Estado de Ubicación</h2>
              <p className={`text-sm ${isAtRestaurant ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isAtRestaurant ? '✓ Estás en el restaurante' : '✗ No estás en el restaurante'}
              </p>
              {!isWorkDay && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  Día no laborable
                </p>
              )}
            </div>
            <div className={`w-4 h-4 rounded-full ${isAtRestaurant ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
        </Card>

        {/* Clock In/Out Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Entrada Button */}
          <Button
            onClick={handleClockIn}
            disabled={!isAtRestaurant || isClockedIn || loading}
            className="btn-primary h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2"
          >
            <Clock className="w-6 h-6" />
            Entrada
            {isLate && <span className="text-xs">Retraso detectado</span>}
          </Button>

          {/* Salida Button */}
          <Button
            onClick={handleClockOut}
            disabled={!isAtRestaurant || !isClockedIn || loading}
            className="btn-secondary h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2"
          >
            <Clock className="w-6 h-6" />
            Salida
          </Button>
        </div>

        {/* Incident Button */}
        <Button
          onClick={handleIncident}
          variant="outline"
          className="w-full mb-8 h-16 text-lg font-semibold flex items-center justify-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          Reportar Incidencia
        </Button>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setLocation('/employee/calendar')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Calendario y Calculadora</h3>
                <p className="text-sm text-muted-foreground">Ver mis horas</p>
              </div>
            </div>
          </Card>
          <Card
            className="p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setLocation('/employee/schedule')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CalendarDays className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Horario</h3>
                <p className="text-sm text-muted-foreground">Ver mis turnos</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Status Info */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Estado actual:</strong> {isClockedIn ? 'Fichado (entrada registrada)' : 'No fichado'}
          </p>
        </div>
      </main>
    </div>
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
