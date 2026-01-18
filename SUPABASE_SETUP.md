# Configuración de Supabase

Esta guía te ayudará a configurar Supabase como base de datos para TimeClock.

## Paso 1: Crear Proyecto en Supabase

1. Accede a [supabase.com](https://supabase.com)
2. Haz clic en "New Project"
3. Selecciona tu organización
4. Configura:
   - **Project name**: `employee_timeclock`
   - **Database password**: Crea una contraseña segura
   - **Region**: Selecciona la más cercana a ti
5. Haz clic en "Create new project"

## Paso 2: Obtener Credenciales

Una vez creado el proyecto:

1. Ve a "Settings" → "Database"
2. Copia la **Connection String** (URI)
3. Reemplaza `[YOUR-PASSWORD]` con la contraseña que creaste

La URL tendrá este formato:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

## Paso 3: Configurar Variables de Entorno

Actualiza tu `.env.local`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

## Paso 4: Crear Tablas

Ejecuta las migraciones:

```bash
pnpm db:push
```

Esto creará automáticamente todas las tablas necesarias.

## Paso 5: Verificar Conexión

Accede al panel de Supabase y ve a "SQL Editor" para verificar que las tablas se crearon correctamente.

## Configuración Adicional

### Habilitar Row Level Security (RLS)

Para mayor seguridad, habilita RLS en Supabase:

1. Ve a "Authentication" → "Policies"
2. Habilita RLS para cada tabla
3. Crea políticas según tus necesidades

### Backups Automáticos

Supabase realiza backups automáticos. Para configurarlos:

1. Ve a "Settings" → "Backups"
2. Configura la frecuencia de backups
3. Descarga backups cuando sea necesario

### Monitoreo

Para monitorear tu base de datos:

1. Ve a "Reports" para ver estadísticas
2. Ve a "Logs" para ver consultas
3. Usa "Monitoring" para alertas

## Despliegue en Vercel con Supabase

### 1. Agregar Variables a Vercel

En tu proyecto de Vercel:

1. Ve a "Settings" → "Environment Variables"
2. Agrega:
   - `DATABASE_URL`: Tu URL de Supabase
   - Todas las demás variables de `.env.example`

### 2. Desplegar

```bash
git push origin main
```

Vercel automáticamente desplegará con las nuevas variables.

## Troubleshooting

### Error: "FATAL: password authentication failed"

- Verifica que la contraseña es correcta
- Asegúrate de haber reemplazado `[YOUR-PASSWORD]`
- Intenta resetear la contraseña en Supabase

### Error: "Connection refused"

- Verifica que el proyecto está activo
- Comprueba que la región es correcta
- Intenta desde otro navegador

### Las tablas no se crearon

```bash
# Limpia y reinicia
pnpm db:push --force
```

## Recursos Útiles

- [Documentación de Supabase](https://supabase.com/docs)
- [Drizzle ORM con PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)

## Seguridad

### Mejores Prácticas

1. **Nunca compartas tu DATABASE_URL** en repositorios públicos
2. **Usa variables de entorno** en producción
3. **Habilita RLS** para proteger datos
4. **Crea backups regulares** de tu base de datos
5. **Monitorea accesos** a través de los logs

### Cambiar Contraseña

Si necesitas cambiar la contraseña:

1. Ve a "Settings" → "Database"
2. Haz clic en "Reset password"
3. Actualiza tu `DATABASE_URL`
4. Redeploy tu aplicación
