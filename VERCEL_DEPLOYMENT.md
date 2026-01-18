# Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar TimeClock en Vercel de forma segura y eficiente.

## Requisitos Previos

- Cuenta en [vercel.com](https://vercel.com)
- Repositorio en GitHub, GitLab o Bitbucket
- Variables de entorno configuradas

## Paso 1: Preparar el Repositorio

### 1.1 Inicializar Git (si no lo has hecho)

```bash
git init
git add .
git commit -m "Initial commit: TimeClock application"
```

### 1.2 Crear Repositorio en GitHub

1. Accede a [github.com](https://github.com)
2. Haz clic en "New repository"
3. Nombra el repositorio: `employee_timeclock`
4. Haz clic en "Create repository"

### 1.3 Subir Código

```bash
git remote add origin https://github.com/tu-usuario/employee_timeclock.git
git branch -M main
git push -u origin main
```

## Paso 2: Conectar a Vercel

### 2.1 Acceder a Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Haz clic en "Sign Up" o "Log In"
3. Conecta tu cuenta de GitHub

### 2.2 Importar Proyecto

1. Haz clic en "Add New..." → "Project"
2. Selecciona tu repositorio `employee_timeclock`
3. Haz clic en "Import"

## Paso 3: Configurar Variables de Entorno

En la pantalla de configuración del proyecto:

### 3.1 Agregar Variables

Haz clic en "Environment Variables" y agrega:

```
DATABASE_URL = postgresql://...  (tu URL de Supabase)
JWT_SECRET = tu-clave-secreta-super-segura
VITE_APP_ID = tu-manus-app-id
OAUTH_SERVER_URL = https://api.manus.im
VITE_OAUTH_PORTAL_URL = https://oauth.manus.im
OWNER_OPEN_ID = tu-owner-open-id
OWNER_NAME = Tu Nombre
BUILT_IN_FORGE_API_KEY = tu-forge-api-key
BUILT_IN_FORGE_API_URL = https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY = tu-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL = https://api.manus.im
VITE_ANALYTICS_ENDPOINT = https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID = tu-website-id
VITE_APP_TITLE = TimeClock - Sistema de Fichaje
VITE_APP_LOGO = /logo.svg
```

### 3.2 Seleccionar Entornos

Para cada variable, selecciona:
- **Production**: Producción
- **Preview**: Vista previa
- **Development**: Desarrollo local (opcional)

## Paso 4: Configurar Build Settings

### 4.1 Build Command

Verifica que esté configurado:
```
pnpm build
```

### 4.2 Output Directory

Verifica que esté configurado:
```
dist
```

### 4.3 Install Command

Verifica que esté configurado:
```
pnpm install
```

## Paso 5: Desplegar

### 5.1 Despliegue Inicial

1. Revisa la configuración
2. Haz clic en "Deploy"
3. Espera a que se complete el despliegue

### 5.2 Monitorear Despliegue

- Vercel mostrará el progreso en tiempo real
- Si hay errores, revisa los logs
- El despliegue típicamente toma 2-5 minutos

## Paso 6: Verificar Despliegue

Una vez completado:

1. Vercel te mostrará la URL de tu aplicación
2. Haz clic en la URL para acceder
3. Prueba las funcionalidades principales

## Despliegues Posteriores

### Despliegue Automático

Cada vez que hagas push a `main`:

```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
```

Vercel automáticamente:
1. Detecta los cambios
2. Ejecuta el build
3. Despliega la nueva versión

### Despliegue Manual

Si necesitas desplegar manualmente:

1. Ve a tu proyecto en Vercel
2. Haz clic en "Deployments"
3. Haz clic en "Redeploy" en el despliegue anterior

## Configurar Dominio Personalizado

### 6.1 Agregar Dominio

1. Ve a "Settings" → "Domains"
2. Haz clic en "Add"
3. Ingresa tu dominio (ej: timeclock.example.com)

### 6.2 Configurar DNS

Vercel te mostrará los registros DNS necesarios:

1. Accede a tu proveedor de dominio
2. Agrega los registros CNAME o A
3. Espera a que se propague (hasta 48 horas)

### 6.3 Verificar

Una vez propagado, accede a tu dominio personalizado.

## Monitoreo y Mantenimiento

### Logs en Tiempo Real

1. Ve a "Deployments"
2. Selecciona un despliegue
3. Ve a "Logs" para ver errores

### Analíticas

1. Ve a "Analytics"
2. Monitorea:
   - Requests
   - Response time
   - Errores

### Alertas

Configura alertas en "Settings" → "Notifications":
- Fallos de despliegue
- Errores en tiempo real
- Límites de uso

## Troubleshooting

### Error: Build failed

1. Revisa los logs en Vercel
2. Verifica que todas las variables de entorno están configuradas
3. Intenta localmente: `pnpm build`

### Error: Database connection failed

1. Verifica que `DATABASE_URL` es correcta
2. Comprueba que la base de datos está activa
3. Verifica permisos de firewall

### Error: Module not found

1. Asegúrate de que todas las dependencias están en `package.json`
2. Ejecuta `pnpm install` localmente
3. Haz push de `pnpm-lock.yaml`

### Aplicación lenta

1. Revisa "Analytics" para bottlenecks
2. Optimiza consultas a base de datos
3. Implementa caching

## Rollback a Versión Anterior

Si algo sale mal:

1. Ve a "Deployments"
2. Selecciona un despliegue anterior
3. Haz clic en "Redeploy"

## Mejores Prácticas

1. **Usa variables de entorno** para datos sensibles
2. **Mantén `main` estable** - usa ramas para desarrollo
3. **Prueba localmente** antes de hacer push
4. **Monitorea logs** regularmente
5. **Realiza backups** de tu base de datos
6. **Usa HTTPS** siempre en producción
7. **Actualiza dependencias** regularmente

## Recursos Útiles

- [Documentación de Vercel](https://vercel.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Troubleshooting Guide](https://vercel.com/support)

## Soporte

Si necesitas ayuda:

1. Revisa los [Vercel Docs](https://vercel.com/docs)
2. Consulta [Community](https://vercel.com/community)
3. Contacta [Vercel Support](https://vercel.com/support)
