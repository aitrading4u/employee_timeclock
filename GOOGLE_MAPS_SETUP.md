# Configuración de Google Maps API

Esta guía te ayudará a configurar Google Maps para la funcionalidad de mapa interactivo en TimeClock.

## Paso 1: Crear Proyecto en Google Cloud

1. Accede a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombra el proyecto: `TimeClock`

## Paso 2: Habilitar APIs

En Google Cloud Console:

1. Ve a "APIs & Services" → "Library"
2. Busca y habilita estas APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Geocoding API**

## Paso 3: Crear Clave API

1. Ve a "APIs & Services" → "Credentials"
2. Haz clic en "Create Credentials" → "API Key"
3. Copia la clave API generada

## Paso 4: Configurar Restricciones

Para mayor seguridad:

1. Selecciona la clave API creada
2. En "Application restrictions", selecciona "HTTP referrers (web sites)"
3. Agrega tus dominios:
   - `localhost:3000` (desarrollo)
   - `yourdomain.com` (producción)
   - `*.vercel.app` (si usas Vercel)

## Paso 5: Actualizar Configuración

Actualiza `client/index.html`:

```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=TU_CLAVE_API_AQUI&libraries=places,geocoding"
  defer></script>
```

Reemplaza `TU_CLAVE_API_AQUI` con tu clave API real.

## Paso 6: Variables de Entorno (Recomendado)

Para mayor seguridad, usa variables de entorno:

1. Agrega a `.env.local`:
```
VITE_GOOGLE_MAPS_API_KEY=tu-clave-api-aqui
```

2. Actualiza `client/index.html`:
```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=%VITE_GOOGLE_MAPS_API_KEY%&libraries=places,geocoding"
  defer></script>
```

## Paso 7: Configurar en Vercel

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - `VITE_GOOGLE_MAPS_API_KEY`: Tu clave API

## Características del Mapa

El mapa interactivo incluye:

- **Click para seleccionar ubicación**: Haz clic en el mapa para establecer la ubicación del restaurante
- **Geocodificación inversa**: Obtiene automáticamente la dirección de las coordenadas
- **Botón "Usar Mi Ubicación"**: Detecta tu posición GPS actual
- **Marcador personalizado**: Muestra la ubicación seleccionada con un marcador azul
- **Zoom y controles**: Controles estándar de Google Maps

## Troubleshooting

### Error: "google is not defined"

- Verifica que el script de Google Maps está cargado en `client/index.html`
- Asegúrate de que la clave API es válida
- Comprueba que las APIs están habilitadas en Google Cloud

### Mapa no se carga

- Verifica la clave API en la consola del navegador (F12)
- Comprueba que el dominio está en la lista blanca de restricciones
- Asegúrate de que la biblioteca de mapas está cargada

### Geocodificación no funciona

- Verifica que "Geocoding API" está habilitada
- Comprueba que "Places API" está habilitada
- Asegúrate de que la clave API tiene permisos para estas APIs

## Costos

Google Maps API tiene un nivel gratuito:

- **Maps JavaScript API**: $7 por 1000 cargas (después de $200 de crédito gratuito)
- **Geocoding API**: $5 por 1000 solicitudes (después de $200 de crédito gratuito)
- **Places API**: Varía según el tipo de solicitud

Para desarrollo, el crédito gratuito debería ser suficiente.

## Seguridad

### Mejores Prácticas

1. **Nunca compartas tu clave API** en repositorios públicos
2. **Usa restricciones de dominio** para limitar uso
3. **Monitorea el uso** en Google Cloud Console
4. **Rota la clave regularmente** en producción
5. **Usa variables de entorno** para las claves

### Proteger tu Clave

Si tu clave se expone:

1. Ve a Google Cloud Console
2. Elimina la clave comprometida
3. Crea una nueva clave
4. Actualiza tu aplicación

## Recursos Útiles

- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Geocoding API](https://developers.google.com/maps/documentation/geocoding)
- [Places API](https://developers.google.com/maps/documentation/places)
- [Google Cloud Console](https://console.cloud.google.com/)

## Soporte

Para problemas con Google Maps:

1. Consulta [Google Maps Documentation](https://developers.google.com/maps/documentation)
2. Revisa [Stack Overflow](https://stackoverflow.com/questions/tagged/google-maps)
3. Contacta [Google Cloud Support](https://cloud.google.com/support)
