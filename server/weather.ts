import type { WeatherForecastResponse, WeatherHour } from '../shared/types.ts';

export function mapWmoCodeToSpanish(code: number): string {
  if (code === 0) return 'Despejado';
  if (code === 1) return 'Mayormente despejado';
  if (code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Niebla o neblina';
  if (code >= 51 && code <= 55) return 'Llovizna';
  if (code >= 56 && code <= 57) return 'Llovizna helada';
  if (code >= 61 && code <= 65) return 'Lluvia';
  if (code >= 66 && code <= 67) return 'Lluvia helada';
  if (code >= 71 && code <= 77) return 'Nieve';
  if (code >= 80 && code <= 82) return 'Chubascos';
  if (code >= 85 && code <= 86) return 'Chubascos de nieve';
  if (code === 95) return 'Tormenta eléctrica';
  if (code >= 96 && code <= 99) return 'Tormenta con granizo';
  return 'Condición variable';
}

export async function fetchWeatherForecast(
  lat: number,
  lng: number
): Promise<WeatherForecastResponse> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Coordenadas geográficas inválidas para consultar el clima.');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toFixed(5));
  url.searchParams.set('longitude', lng.toFixed(5));
  url.searchParams.set('current', 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m');
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code');
  url.searchParams.set('forecast_hours', '24');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`La API meteorológica respondió con estado ${res.status}.`);
  }

  const data = (await res.json()) as {
    latitude: number;
    longitude: number;
    timezone: string;
    current?: {
      time: string;
      temperature_2m: number;
      precipitation_probability?: number;
      weather_code: number;
      wind_speed_10m?: number;
    };
    hourly?: {
      time: string[];
      temperature_2m: number[];
      precipitation_probability: number[];
      weather_code: number[];
    };
  };

  if (!data.current || !data.hourly || !Array.isArray(data.hourly.time)) {
    throw new Error('La respuesta meteorológica no incluyó el pronóstico horario completo.');
  }

  const hourly: WeatherHour[] = data.hourly.time.slice(0, 24).map((t, idx) => {
    const wCode = Number(data.hourly?.weather_code?.[idx] ?? 0);
    return {
      time: t,
      temperature: Number(data.hourly?.temperature_2m?.[idx] ?? 0),
      rainProbability: Number(data.hourly?.precipitation_probability?.[idx] ?? 0),
      weatherCode: wCode,
      weatherLabel: mapWmoCodeToSpanish(wCode),
    };
  });

  const currentCode = Number(data.current.weather_code ?? 0);
  const currentRainProb =
    typeof data.current.precipitation_probability === 'number'
      ? data.current.precipitation_probability
      : hourly[0]?.rainProbability ?? 0;

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone || 'UTC',
    current: {
      time: data.current.time,
      temperature: Number(data.current.temperature_2m),
      rainProbability: Number(currentRainProb),
      weatherCode: currentCode,
      weatherLabel: mapWmoCodeToSpanish(currentCode),
      windSpeed: Number(data.current.wind_speed_10m ?? 0),
    },
    hourly,
  };
}
