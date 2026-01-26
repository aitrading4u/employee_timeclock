import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, MapPin, Users, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import RestaurantMap from '@/components/RestaurantMap';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('restaurant');
  
  // Restaurant form state
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [latitude, setLatitude] = useState(40.7128);
  const [longitude, setLongitude] = useState(-74.006);
  const [radiusMeters, setRadiusMeters] = useState(100);

  // Employee form state
  const [employeeName, setEmployeeName] = useState('');
  const [employeeUsername, setEmployeeUsername] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [lateGraceMinutes, setLateGraceMinutes] = useState('5');
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [workedHours, setWorkedHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [incidentEmployeeId, setIncidentEmployeeId] = useState('');
  const [editingTimeclockId, setEditingTimeclockId] = useState<number | null>(null);
  const [editingEntryTime, setEditingEntryTime] = useState('');
  const [editingExitTime, setEditingExitTime] = useState('');
  const [employeeSchedule, setEmployeeSchedule] = useState(() => ({
    monday: { entry1: '', entry2: '', isActive: true },
    tuesday: { entry1: '', entry2: '', isActive: true },
    wednesday: { entry1: '', entry2: '', isActive: true },
    thursday: { entry1: '', entry2: '', isActive: true },
    friday: { entry1: '', entry2: '', isActive: true },
    saturday: { entry1: '', entry2: '', isActive: true },
    sunday: { entry1: '', entry2: '', isActive: true },
  }));
  const scheduleDays = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ] as const;

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  );
  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, '0')
  );

  const parseTime = (value: string) => {
    if (!value) return { hour: '', minute: '' };
    const [hour, minute] = value.split(':');
    return { hour: hour || '', minute: minute || '' };
  };

  const buildTime = (hour: string, minute: string) => {
    if (!hour && !minute) return '';
    const normalizedHour = hour || '00';
    const normalizedMinute = minute || '00';
    return `${normalizedHour}:${normalizedMinute}`;
  };

  const updateScheduleTime = (
    day: keyof typeof employeeSchedule,
    field: 'entry1' | 'entry2',
    hour: string,
    minute: string
  ) => {
    handleScheduleChange(day, field, buildTime(hour, minute));
  };

  const salaryTotal = (() => {
    const hours = Number(workedHours);
    const rate = Number(hourlyRate);
    if (Number.isNaN(hours) || Number.isNaN(rate)) return 0;
    return Math.max(hours, 0) * Math.max(rate, 0);
  })();

  const formatDateTimeInput = (value?: string | Date | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const { adminAuth, setAdminAuth } = useAuthContext();
  const adminUsername = adminAuth?.username || '';
  const adminPassword = adminAuth?.password || '';

  const getRestaurant = trpc.publicApi.getRestaurant.useQuery(
    { username: adminUsername, password: adminPassword },
    { enabled: Boolean(adminUsername && adminPassword) }
  );
  const upsertRestaurant = trpc.publicApi.upsertRestaurant.useMutation();
  const createEmployee = trpc.publicApi.createEmployee.useMutation();
  const listEmployees = trpc.publicApi.listEmployees.useQuery(
    { username: adminUsername, password: adminPassword },
    { enabled: Boolean(adminUsername && adminPassword) }
  );
  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    {
      username: adminUsername,
      password: adminPassword,
      employeeId: editingEmployeeId ?? 0,
    },
    { enabled: Boolean(adminUsername && adminPassword && editingEmployeeId) }
  );
  const updateEmployee = trpc.publicApi.updateEmployee.useMutation();
  const listIncidents = trpc.publicApi.listIncidents.useQuery(
    { username: adminUsername, password: adminPassword },
    { enabled: Boolean(adminUsername && adminPassword) }
  );
  const timeclocksQuery = trpc.publicApi.listTimeclocks.useQuery(
    { username: adminUsername, password: adminPassword },
    { enabled: Boolean(adminUsername && adminPassword) }
  );
  const updateTimeclock = trpc.publicApi.updateTimeclock.useMutation();

  const filteredTimeclocks = (timeclocksQuery.data || [])
    .filter((entry) =>
      selectedEmployeeId ? String(entry.employeeId) === selectedEmployeeId : true
    )
    .filter((entry) => {
    if (!rangeStart && !rangeEnd) return true;
    const entryDate = new Date(entry.entryTime || entry.createdAt);
    if (rangeStart) {
      const start = new Date(rangeStart);
      start.setHours(0, 0, 0, 0);
      if (entryDate < start) return false;
    }
    if (rangeEnd) {
      const end = new Date(rangeEnd);
      end.setHours(23, 59, 59, 999);
      if (entryDate > end) return false;
    }
    return true;
  });

  const employeeNameById = new Map(
    (listEmployees.data || []).map((employee) => [employee.id, employee.name])
  );

  const totalHours = filteredTimeclocks.reduce((total, entry) => {
    if (!entry.entryTime || !entry.exitTime) return total;
    const start = new Date(entry.entryTime).getTime();
    const end = new Date(entry.exitTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return total;
    return total + (end - start) / (1000 * 60 * 60);
  }, 0);

  const handleScheduleChange = (
    day: keyof typeof employeeSchedule,
    field: 'entry1' | 'entry2',
    value: string
  ) => {
    setEmployeeSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleScheduleToggle = (day: keyof typeof employeeSchedule) => {
    setEmployeeSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isActive: !prev[day].isActive,
      },
    }));
  };

  const handleEditTimeclock = (entry: { id: number; entryTime?: string | null; exitTime?: string | null }) => {
    setEditingTimeclockId(entry.id);
    setEditingEntryTime(formatDateTimeInput(entry.entryTime));
    setEditingExitTime(formatDateTimeInput(entry.exitTime));
  };

  const handleCancelTimeclockEdit = () => {
    setEditingTimeclockId(null);
    setEditingEntryTime('');
    setEditingExitTime('');
  };

  const handleSaveTimeclock = () => {
    if (!editingTimeclockId) return;
    if (!editingEntryTime) {
      toast.error('La hora de entrada es obligatoria');
      return;
    }
    if (editingExitTime) {
      const entryDate = new Date(editingEntryTime);
      const exitDate = new Date(editingExitTime);
      if (Number.isNaN(entryDate.getTime()) || Number.isNaN(exitDate.getTime())) {
        toast.error('Formato de fecha inválido');
        return;
      }
      if (exitDate <= entryDate) {
        toast.error('La salida debe ser posterior a la entrada');
        return;
      }
    }
    updateTimeclock
      .mutateAsync({
        username: adminUsername,
        password: adminPassword,
        timeclockId: editingTimeclockId,
        entryTime: editingEntryTime,
        exitTime: editingExitTime || null,
      })
      .then(() => {
        toast.success('Fichaje actualizado');
        handleCancelTimeclockEdit();
        timeclocksQuery.refetch();
      })
      .catch((error) => {
        toast.error('No se pudo actualizar el fichaje');
        console.error(error);
      });
  };

  const handleLogout = () => {
    setAdminAuth(null);
    setLocation('/');
  };

  const handleSaveRestaurant = () => {
    if (!restaurantName || !restaurantAddress) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    upsertRestaurant
      .mutateAsync({
        username: adminUsername,
        password: adminPassword,
        name: restaurantName,
        address: restaurantAddress,
        latitude,
        longitude,
        radiusMeters,
      })
      .then(() => {
        toast.success('Restaurante guardado correctamente');
        getRestaurant.refetch();
      })
      .catch((error) => {
        toast.error('Error al guardar restaurante');
        console.error(error);
      });
  };

  const handleCreateEmployee = () => {
    if (!employeeName || !employeeUsername || (!editingEmployeeId && !employeePassword)) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    if (employeePassword && employeePassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const parsedGraceMinutes = Number(lateGraceMinutes);
    const graceMinutesValue = Number.isFinite(parsedGraceMinutes)
      ? Math.max(0, parsedGraceMinutes)
      : 5;
    const action = editingEmployeeId
      ? updateEmployee.mutateAsync({
          username: adminUsername,
          password: adminPassword,
          employeeId: editingEmployeeId,
          employeeName,
          employeeUsername,
          employeePassword: employeePassword || undefined,
          employeePhone,
          lateGraceMinutes: graceMinutesValue,
          schedule: employeeSchedule,
        })
      : createEmployee.mutateAsync({
          username: adminUsername,
          password: adminPassword,
          employeeName,
          employeeUsername,
          employeePassword,
          employeePhone,
          lateGraceMinutes: graceMinutesValue,
          schedule: employeeSchedule,
        });

    action
      .then(() => {
        toast.success(
          editingEmployeeId
            ? `Empleado ${employeeName} actualizado correctamente`
            : `Empleado ${employeeName} creado correctamente`
        );
        setEmployeeName('');
        setEmployeeUsername('');
        setEmployeePassword('');
        setEmployeePhone('');
        setLateGraceMinutes('5');
        setEditingEmployeeId(null);
        setEmployeeSchedule({
          monday: { entry1: '', entry2: '', isActive: true },
          tuesday: { entry1: '', entry2: '', isActive: true },
          wednesday: { entry1: '', entry2: '', isActive: true },
          thursday: { entry1: '', entry2: '', isActive: true },
          friday: { entry1: '', entry2: '', isActive: true },
          saturday: { entry1: '', entry2: '', isActive: true },
          sunday: { entry1: '', entry2: '', isActive: true },
        });
        listEmployees.refetch();
      })
      .catch((error) => {
        toast.error(
          editingEmployeeId ? 'Error al actualizar empleado' : 'Error al crear empleado'
        );
        console.error(error);
      });
  };

  const handleEditEmployee = (employeeId: number) => {
    const employee = listEmployees.data?.find((item) => item.id === employeeId);
    if (!employee) return;
    setEditingEmployeeId(employeeId);
    setEmployeeName(employee.name);
    setEmployeeUsername(employee.username);
    setEmployeePassword('');
    setEmployeePhone(employee.phone || '');
    setLateGraceMinutes(String(employee.lateGraceMinutes ?? 5));
  };

  useEffect(() => {
    if (employeeScheduleQuery.data) {
      setEmployeeSchedule({
        monday: { entry1: '', entry2: '', isActive: true },
        tuesday: { entry1: '', entry2: '', isActive: true },
        wednesday: { entry1: '', entry2: '', isActive: true },
        thursday: { entry1: '', entry2: '', isActive: true },
        friday: { entry1: '', entry2: '', isActive: true },
        saturday: { entry1: '', entry2: '', isActive: true },
        sunday: { entry1: '', entry2: '', isActive: true },
        ...employeeScheduleQuery.data,
      });
    }
  }, [employeeScheduleQuery.data]);

  useEffect(() => {
    if (getRestaurant.data) {
      setRestaurantName(getRestaurant.data.name || '');
      setRestaurantAddress(getRestaurant.data.address || '');
      setLatitude(Number(getRestaurant.data.latitude));
      setLongitude(Number(getRestaurant.data.longitude));
      setRadiusMeters(getRestaurant.data.radiusMeters);
    }
  }, [getRestaurant.data]);

  useEffect(() => {
    if (!adminAuth) {
      setLocation('/admin-login');
    }
  }, [adminAuth, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <AlertCircle className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Panel de Administrador</h1>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="restaurant" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Restaurante</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Empleados</span>
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Horas</span>
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Incidencias</span>
            </TabsTrigger>
          </TabsList>

          {/* Restaurant Tab */}
          <TabsContent value="restaurant" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Gestión del Restaurante</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre del Restaurante
                  </label>
                  <input
                    type="text"
                    placeholder="Mi Restaurante"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    placeholder="Calle Principal, 123"
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Radio de Validación (metros)
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="input-elegant"
                    />
                  </div>
                </div>
              </div>

              {/* Map Component */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Seleccionar Ubicación</h3>
                <RestaurantMap
                  latitude={latitude}
                  longitude={longitude}
                  onLocationSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  onAddressChange={(address) => setRestaurantAddress(address)}
                />
              </div>

              <Button onClick={handleSaveRestaurant} className="w-full btn-primary">
                Guardar Restaurante
              </Button>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Gestión de Empleados</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre del Empleado
                  </label>
                  <input
                    type="text"
                    placeholder="Juan García"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Usuario
                  </label>
                  <input
                    type="text"
                    placeholder="juan.garcia"
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={employeePassword}
                    onChange={(e) => setEmployeePassword(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+34 600 123 456"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Minutos de gracia (retraso)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="5"
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(e.target.value)}
                    className="input-elegant"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Permite fichar después de la hora sin marcar retraso.
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Horario de entrada
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Puedes definir hasta dos horas de entrada por día.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {scheduleDays.map(day => (
                      <div
                        key={day.key}
                        className="grid grid-cols-1 md:grid-cols-[120px,1fr,1fr,auto] gap-2 items-center"
                      >
                        <span className="text-sm text-foreground">
                          {day.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const time = parseTime(employeeSchedule[day.key].entry1);
                            return (
                              <>
                                <select
                                  className="input-elegant"
                                  value={time.hour}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry1', e.target.value, time.minute)
                                  }
                                >
                                  <option value="">HH</option>
                                  {hourOptions.map((hour) => (
                                    <option key={hour} value={hour}>
                                      {hour}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground">:</span>
                                <select
                                  className="input-elegant"
                                  value={time.minute}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry1', time.hour, e.target.value)
                                  }
                                >
                                  <option value="">MM</option>
                                  {minuteOptions.map((minute) => (
                                    <option key={minute} value={minute}>
                                      {minute}
                                    </option>
                                  ))}
                                </select>
                              </>
                            );
                          })()}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleScheduleChange(day.key, 'entry1', '')}
                          >
                            Limpiar
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const time = parseTime(employeeSchedule[day.key].entry2);
                            return (
                              <>
                                <select
                                  className="input-elegant"
                                  value={time.hour}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry2', e.target.value, time.minute)
                                  }
                                >
                                  <option value="">HH</option>
                                  {hourOptions.map((hour) => (
                                    <option key={hour} value={hour}>
                                      {hour}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground">:</span>
                                <select
                                  className="input-elegant"
                                  value={time.minute}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry2', time.hour, e.target.value)
                                  }
                                >
                                  <option value="">MM</option>
                                  {minuteOptions.map((minute) => (
                                    <option key={minute} value={minute}>
                                      {minute}
                                    </option>
                                  ))}
                                </select>
                              </>
                            );
                          })()}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleScheduleChange(day.key, 'entry2', '')}
                          >
                            Limpiar
                          </Button>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={employeeSchedule[day.key].isActive}
                            onChange={() => handleScheduleToggle(day.key)}
                          />
                          Activo
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleCreateEmployee} className="w-full btn-primary">
                  {editingEmployeeId ? "Guardar cambios" : "Crear Empleado"}
                </Button>
              </div>

              {/* Employee List */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-foreground mb-4">Empleados Registrados</h3>
                <div className="space-y-2">
                  {listEmployees.data?.length ? (
                    listEmployees.data.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">Usuario: {employee.username}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditEmployee(employee.id)}
                        >
                          Editar
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay empleados registrados.</p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Calendario de Horas</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Seleccionar Empleado
                  </label>
                  <select
                    className="input-elegant"
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    <option value="">Selecciona un empleado</option>
                    {listEmployees.data?.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                      className="input-elegant"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                      className="input-elegant"
                    />
                  </div>
                </div>
              </div>

              {/* Calendar Display */}
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-muted-foreground">Horas registradas: {totalHours.toFixed(2)}h</p>
              </div>
              <div className="mt-4 space-y-2">
                {filteredTimeclocks.length ? (
                  filteredTimeclocks.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-4 p-3 border border-border rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          {employeeNameById.get(entry.employeeId) || `Empleado #${entry.employeeId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Entrada:{" "}
                          {entry.entryTime
                            ? new Date(entry.entryTime).toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Sin entrada"}
                          {" · "}
                          {entry.entryTime
                            ? new Date(entry.entryTime).toLocaleDateString("es-ES")
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Salida:{" "}
                          {entry.exitTime
                            ? new Date(entry.exitTime).toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Pendiente"}
                          {entry.exitTime
                            ? ` · ${new Date(entry.exitTime).toLocaleDateString("es-ES")}`
                            : ""}
                        </p>
                        {editingTimeclockId === entry.id && (
                          <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3">
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                Entrada
                              </label>
                              <input
                                type="datetime-local"
                                value={editingEntryTime}
                                onChange={(event) => setEditingEntryTime(event.target.value)}
                                className="input-elegant"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                Salida
                              </label>
                              <input
                                type="datetime-local"
                                value={editingExitTime}
                                onChange={(event) => setEditingExitTime(event.target.value)}
                                className="input-elegant"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Deja vacío si no hay salida registrada.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={handleSaveTimeclock}>
                                Guardar cambios
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelTimeclockEdit}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm text-muted-foreground">
                          {entry.isLate ? "Retraso" : "OK"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditTimeclock(entry)}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay fichajes en este rango.</p>
                )}
              </div>
              <div className="mt-6 border border-border rounded-lg p-4 space-y-4">
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
                    value={workedHours}
                    onChange={(event) => setWorkedHours(event.target.value)}
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
            </Card>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Gestión de Incidencias</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Seleccionar Empleado
                  </label>
                  <select
                    className="input-elegant"
                    value={incidentEmployeeId}
                    onChange={(event) => setIncidentEmployeeId(event.target.value)}
                  >
                    <option value="">Todos los empleados</option>
                    {listEmployees.data?.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Incidents List */}
              <div className="space-y-4">
                {(listIncidents.data || [])
                  .filter((incident) =>
                    incidentEmployeeId ? String(incident.employeeId) === incidentEmployeeId : true
                  )
                  .length ? (
                  (listIncidents.data || [])
                    .filter((incident) =>
                      incidentEmployeeId ? String(incident.employeeId) === incidentEmployeeId : true
                    )
                    .map((incident) => (
                    <div key={incident.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {incident.type === "late_arrival" ? "Retraso en la entrada" : "Incidencia"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Empleado #{incident.employeeId} - {new Date(incident.createdAt).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <span className={incident.status === "pending" ? "badge-warning" : incident.status === "approved" ? "badge-success" : "badge-error"}>
                          {incident.status === "pending" ? "Pendiente" : incident.status === "approved" ? "Aprobada" : "Rechazada"}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-3">{incident.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay incidencias registradas.</p>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
