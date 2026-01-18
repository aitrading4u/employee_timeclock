# TimeClock - Sistema de Fichaje de Empleados

Una aplicación web elegante y profesional para la gestión de fichaje de empleados con validación por geolocalización GPS, panel de administrador completo y gestión de incidencias.

## Características Principales

### Para Empleados
- **Autenticación Persistente**: Login seguro con sesión persistente
- **Validación GPS**: Solo se puede fichar dentro del radio del restaurante
- **Botones de Control**: Entrada, Salida e Incidencia
- **Bloqueo por Retraso**: El botón de Entrada se bloquea si el empleado llega tarde
- **Calendario Personal**: Registro completo de horas trabajadas
- **Calculadora de Horas**: Visualizar totales por día, semana o mes

### Para Administradores
- **Gestión de Restaurante**: Crear y configurar ubicación con mapa
- **Gestión de Empleados**: Crear cuentas y asignar horarios
- **Calendario de Horas**: Consultar horas trabajadas por empleado
- **Gestión de Incidencias**: Revisar y aprobar/rechazar incidencias

## Requisitos Previos

- Node.js 18+ 
- pnpm (gestor de paquetes)
- MySQL 8+ o compatible
- Git

## Instalación Local

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd employee_timeclock
```

### 2. Instalar Dependencias

```bash
pnpm install
```

### 3. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env.local` y configura las variables necesarias:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:

```env
DATABASE_URL=mysql://user:password@localhost:3306/employee_timeclock
JWT_SECRET=tu-clave-secreta-super-segura
VITE_APP_ID=tu-manus-app-id
# ... otras variables
```

### 4. Configurar Base de Datos

```bash
pnpm db:push
```

Este comando generará las migraciones y creará las tablas necesarias.

### 5. Iniciar Servidor de Desarrollo

```bash
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`

## Estructura del Proyecto

```
employee_timeclock/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas principales
│   │   ├── components/    # Componentes reutilizables
│   │   ├── lib/           # Utilidades y configuración
│   │   └── App.tsx        # Enrutador principal
│   └── public/            # Archivos estáticos
├── server/                # Backend Express + tRPC
│   ├── routers.ts         # Procedimientos tRPC
│   ├── db.ts              # Consultas a base de datos
│   └── _core/             # Configuración del servidor
├── drizzle/               # Esquema y migraciones
│   └── schema.ts          # Definición de tablas
└── shared/                # Código compartido
```

## Flujo de Autenticación

### Empleado
1. Accede a `/employee-login`
2. Ingresa email y contraseña
3. Se valida la ubicación GPS
4. Accede al dashboard de empleado

### Administrador
1. Accede a `/admin-login`
2. Ingresa credenciales de administrador
3. Accede al panel de control completo

## API Endpoints (tRPC)

### Autenticación
- `auth.me` - Obtener usuario actual
- `auth.logout` - Cerrar sesión

### Restaurante
- `restaurant.getByAdmin` - Obtener restaurante del admin
- `restaurant.create` - Crear restaurante
- `restaurant.update` - Actualizar restaurante

### Empleados
- `employee.list` - Listar empleados
- `employee.create` - Crear empleado
- `employee.getById` - Obtener empleado

### Horarios
- `schedule.getByEmployee` - Obtener horarios del empleado
- `schedule.create` - Crear horario

### Fichaje
- `timeclock.getByEmployee` - Obtener registros de fichaje
- `timeclock.clockIn` - Registrar entrada
- `timeclock.clockOut` - Registrar salida

### Incidencias
- `incident.getByEmployee` - Obtener incidencias
- `incident.create` - Crear incidencia
- `incident.list` - Listar todas las incidencias (admin)
- `incident.updateStatus` - Actualizar estado (admin)

## Configuración de Supabase

Para usar Supabase como base de datos:

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Obtén la URL de conexión PostgreSQL
3. Configura en `.env.local`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

4. Ejecuta las migraciones:

```bash
pnpm db:push
```

## Despliegue en Vercel

### 1. Preparar Proyecto

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Conectar a Vercel

1. Accede a [vercel.com](https://vercel.com)
2. Importa el repositorio
3. Configura las variables de entorno en el panel de Vercel
4. Haz clic en "Deploy"

### 3. Configurar Variables de Entorno en Vercel

En la configuración del proyecto, añade todas las variables de `.env.example`:

- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- ... (todas las demás)

### 4. Desplegar

Vercel automáticamente desplegará tu aplicación cuando hagas push a la rama principal.

## Validación de Ubicación GPS

La aplicación utiliza la API de Geolocalización del navegador para:

1. Obtener la ubicación actual del empleado
2. Calcular la distancia al restaurante
3. Validar si está dentro del radio permitido (por defecto 100 metros)

**Nota**: El navegador solicitará permiso para acceder a la ubicación.

## Lógica de Retrasos

- Se compara la hora actual con la hora de entrada programada
- Si el empleado llega después de la hora programada:
  - El botón "Entrada" se desactiva
  - Se requiere crear una incidencia explicando el retraso
  - El registro se marca como "retraso"

## Pruebas

Para ejecutar las pruebas unitarias:

```bash
pnpm test
```

Para ejecutar con cobertura:

```bash
pnpm test:coverage
```

## Desarrollo

### Agregar Nueva Tabla

1. Edita `drizzle/schema.ts`
2. Ejecuta `pnpm db:push`
3. Agrega consultas en `server/db.ts`
4. Crea procedimientos en `server/routers.ts`

### Agregar Nueva Página

1. Crea archivo en `client/src/pages/`
2. Registra la ruta en `client/src/App.tsx`
3. Usa componentes de `client/src/components/ui/`

## Troubleshooting

### Error de Conexión a Base de Datos
- Verifica que MySQL está corriendo
- Comprueba la URL en `.env.local`
- Asegúrate de que la base de datos existe

### Errores de Geolocalización
- Verifica que el navegador tiene permisos de ubicación
- Usa HTTPS en producción (requerido para GPS)
- Comprueba la consola del navegador para errores

### Problemas de Compilación
```bash
# Limpia caché y reinstala
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

## Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para soporte, contacta a través de:
- Email: support@timeclock.app
- Issues: [GitHub Issues](https://github.com/yourusername/employee_timeclock/issues)

## Changelog

### v1.0.0 (2024-01-15)
- Lanzamiento inicial
- Autenticación de empleados y administradores
- Validación GPS
- Gestión de fichaje
- Panel de administrador
- Gestión de incidencias
