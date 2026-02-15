import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RestaurantMapProps {
  latitude: number;
  longitude: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressChange?: (address: string) => void;
}

declare global {
  interface Window {
    google?: typeof google;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_SCRIPT_SELECTOR = 'script[data-timeclock-google-maps="true"]';

function waitForGoogleMaps(timeoutMs = 15000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const interval = window.setInterval(() => {
      if (window.google?.maps) {
        window.clearInterval(interval);
        resolve(true);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        window.clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

async function ensureGoogleMapsLoaded(): Promise<boolean> {
  if (window.google?.maps) return true;

  const existingScript = document.querySelector<HTMLScriptElement>(GOOGLE_SCRIPT_SELECTOR);
  if (existingScript) {
    return await waitForGoogleMaps();
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return false;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.setAttribute('data-timeclock-google-maps', 'true');
  document.head.appendChild(script);

  return await waitForGoogleMaps();
}

export default function RestaurantMap({
  latitude,
  longitude,
  onLocationSelect,
  onAddressChange,
}: RestaurantMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapContainer.current) return;

      const loaded = await ensureGoogleMapsLoaded();
      if (cancelled) return;
      if (!loaded || !window.google?.maps) {
        setMapsLoadError(
          'No se pudo cargar Google Maps. Revisa la API key y las restricciones del dominio.'
        );
        return;
      }

      setMapsReady(true);
      setMapsLoadError(null);

      const mapOptions: google.maps.MapOptions = {
        center: { lat: latitude || 40.7128, lng: longitude || -74.006 },
        zoom: 15,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      };

      map.current = new window.google.maps.Map(mapContainer.current, mapOptions);

      // Add click listener to map
      map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          updateMarker(lat, lng);
          onLocationSelect(lat, lng);
        }
      });

      // Add initial marker if coordinates exist
      if (latitude && longitude) {
        updateMarker(latitude, longitude);
      }

      if (searchInputRef.current) {
        autocomplete.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          fields: ['geometry', 'formatted_address'],
        });

        autocomplete.current.addListener('place_changed', () => {
          const place = autocomplete.current?.getPlace();
          const location = place?.geometry?.location;
          if (!location) {
            toast.error('No se pudo encontrar la ubicación');
            return;
          }
          const lat = location.lat();
          const lng = location.lng();
          updateMarker(lat, lng);
          onLocationSelect(lat, lng);
          const address = place?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setLocationName(address);
          setSearchValue(address);
          if (onAddressChange) {
            onAddressChange(address);
          }
        });
      }
    };

    initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateMarker = (lat: number, lng: number) => {
    if (!window.google?.maps || !map.current) return;

    if (marker.current) {
      marker.current.setMap(null);
    }

    marker.current = new window.google.maps.Marker({
      position: { lat, lng },
      map: map.current,
      title: 'Ubicación del Restaurante',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#1e40af',
        strokeWeight: 2,
      },
    });

    if (map.current) {
      map.current.panTo({ lat, lng });
    }

    // Get address from coordinates
    getAddressFromCoordinates(lat, lng);
  };

  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      if (!window.google?.maps) {
        setLocationName(fallbackAddress);
        if (onAddressChange) {
          onAddressChange(fallbackAddress);
        }
        return;
      }
      const geocoder = new window.google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });

      if (result.results && result.results[0]) {
        const address = result.results[0].formatted_address;
        setLocationName(address);
        if (onAddressChange) {
          onAddressChange(address);
        }
      } else {
        setLocationName(fallbackAddress);
        if (onAddressChange) {
          onAddressChange(fallbackAddress);
        }
      }
    } catch (error) {
      console.error('Error getting address:', error);
      setLocationName(fallbackAddress);
      if (onAddressChange) {
        onAddressChange(fallbackAddress);
      }
    }
  };

  const handleUseMyLocation = () => {
    setLoading(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          updateMarker(lat, lng);
          onLocationSelect(lat, lng);
          setLoading(false);
          toast.success('Ubicación obtenida correctamente');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('No se pudo obtener tu ubicación');
          setLoading(false);
        }
      );
    } else {
      toast.error('Geolocalización no disponible en tu navegador');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Buscar dirección
        </label>
        <input
          ref={searchInputRef}
          type="text"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Escribe una dirección o selecciona en el mapa"
          className="input-elegant"
          disabled={!mapsReady}
        />
      </div>
      {mapsLoadError ? (
        <div className="w-full h-96 rounded-lg border border-border shadow-md p-4 flex items-center justify-center text-center text-sm text-red-600 dark:text-red-400 bg-card">
          {mapsLoadError}
        </div>
      ) : (
        <div
          ref={mapContainer}
          className="w-full h-96 rounded-lg border border-border shadow-md"
        />
      )}

      {/* Location Info */}
      {locationName && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Ubicación:</strong> {locationName}
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
            Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
          </p>
        </div>
      )}

      {/* Use My Location Button */}
      <Button
        onClick={handleUseMyLocation}
        disabled={loading || !mapsReady}
        className="w-full flex items-center justify-center gap-2"
        variant="outline"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Obteniendo ubicación...
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            Usar Mi Ubicación
          </>
        )}
      </Button>

      {/* Instructions */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <strong>Instrucciones:</strong> Haz clic en el mapa para seleccionar la ubicación del restaurante, o usa el botón "Usar Mi Ubicación" para detectar tu posición actual.
        </p>
      </div>
    </div>
  );
}
