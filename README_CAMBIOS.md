# Archivos Modificados - TimeClock

Este ZIP contiene todos los archivos que han sido modificados en la última actualización de TimeClock.

## Archivos Incluidos

### 1. **client/src/const.ts**
- **Cambio**: Agregado manejo de errores y valores por defecto para variables de entorno
- **Razón**: Evitar errores cuando las variables de OAuth no están configuradas
- **Ubicación en tu proyecto**: `employee_timeclock/client/src/const.ts`

### 2. **client/src/_core/hooks/useAuth.ts**
- **Cambio**: Movida la llamada a `getLoginUrl()` dentro de `useMemo`
- **Razón**: Evitar que se ejecute en cada renderizado y causar errores
- **Ubicación en tu proyecto**: `employee_timeclock/client/src/_core/hooks/useAuth.ts`

### 3. **client/src/pages/AdminDashboard.tsx**
- **Cambio**: Integrado componente de mapa interactivo y formulario de empleado mejorado
- **Razón**: Agregar mapa de Google Maps y campos de usuario/contraseña
- **Ubicación en tu proyecto**: `employee_timeclock/client/src/pages/AdminDashboard.tsx`

### 4. **client/src/components/RestaurantMap.tsx** (NUEVO)
- **Cambio**: Componente nuevo para mapa interactivo
- **Razón**: Permitir seleccionar ubicación del restaurante en el mapa
- **Ubicación en tu proyecto**: `employee_timeclock/client/src/components/RestaurantMap.tsx`

### 5. **client/index.html**
- **Cambio**: Agregado script de Google Maps API
- **Razón**: Cargar la librería de Google Maps
- **Ubicación en tu proyecto**: `employee_timeclock/client/index.html`

### 6. **drizzle/schema.ts**
- **Cambio**: Reemplazado campo `email` por `username` y `password` en tabla `employees`
- **Razón**: Cambio de autenticación de empleados
- **Ubicación en tu proyecto**: `employee_timeclock/drizzle/schema.ts`

### 7. **server/routers.ts**
- **Cambio**: Actualizado procedimiento `employee.create` para usar `username` y `password`
- **Razón**: Sincronizar con cambios en schema
- **Ubicación en tu proyecto**: `employee_timeclock/server/routers.ts`

### 8. **GOOGLE_MAPS_SETUP.md** (NUEVO)
- **Cambio**: Documentación de configuración de Google Maps
- **Razón**: Guía para configurar API key de Google Maps
- **Ubicación en tu proyecto**: `employee_timeclock/GOOGLE_MAPS_SETUP.md`

## Cómo Usar Estos Archivos

### Opción 1: Reemplazar Manualmente
1. Descarga el ZIP
2. Extrae los archivos
3. Copia cada archivo a su ubicación correspondiente en tu proyecto
4. Asegúrate de mantener la estructura de carpetas

### Opción 2: Usar en tu Proyecto Existente
Si ya tienes el proyecto en Windsurf:

1. Reemplaza los archivos uno por uno
2. Ejecuta `pnpm db:push` para aplicar cambios de schema
3. Recarga el servidor con `pnpm dev`

## Cambios Importantes

### Base de Datos
Si es la primera vez que aplicas estos cambios:
```bash
cd employee_timeclock
pnpm db:push
```

Esto creará una migración para cambiar la tabla `employees`:
- Elimina campo `email`
- Agrega campo `username` (único)
- Agrega campo `password` (hasheado)

### Google Maps
Debes configurar tu API key:
1. Ve a `client/index.html`
2. Busca la línea con `AIzaSyDummyKeyForDevelopment`
3. Reemplázala con tu clave API real
4. O usa variables de entorno (ver GOOGLE_MAPS_SETUP.md)

## Verificación

Después de aplicar los cambios:

1. **Verifica que no hay errores de TypeScript**:
   ```bash
   pnpm check
   ```

2. **Inicia el servidor**:
   ```bash
   pnpm dev
   ```

3. **Prueba la aplicación**:
   - Accede a http://localhost:3000
   - No debería haber error de "Invalid URL"
   - El mapa debería cargar en la pestaña de Restaurante

## Soporte

Si tienes problemas:

1. Verifica que todos los archivos están en la ubicación correcta
2. Ejecuta `pnpm install` para reinstalar dependencias
3. Limpia caché: `rm -rf node_modules/.vite`
4. Reinicia el servidor: `pnpm dev`

## Resumen de Cambios

| Aspecto | Antes | Después |
|--------|-------|---------|
| Autenticación Empleado | Email | Usuario + Contraseña |
| Mapa | No incluido | Google Maps interactivo |
| Ubicación | Manual | Automática (GPS) |
| Errores OAuth | Crash | Manejo elegante |

---

**Fecha de actualización**: 17 de Enero de 2024
**Versión**: 0356bf81
