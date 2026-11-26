export type ProductCategory =
  | 'Protección Solar'
  | 'Higiene Corporal'
  | 'Cuidado Facial'
  | 'Higiene Bucal'
  | 'Cuidado Capilar'
  | 'Botiquín e Higiene';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Protección Solar',
  'Higiene Corporal',
  'Cuidado Facial',
  'Higiene Bucal',
  'Cuidado Capilar',
  'Botiquín e Higiene',
];

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  contact: string;
  hours: string;
  is_24h: boolean;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Product {
  id: string;
  pharmacy_id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  presentation: string;
  price: number;
  stock: number;
  available: boolean;
  description: string;
  image_url: string;
  updated_at: string;
}

export interface WeatherHour {
  time: string;
  temperature: number;
  rainProbability: number;
  weatherCode: number;
  weatherLabel: string;
}

export interface WeatherForecastResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature: number;
    rainProbability: number;
    weatherCode: number;
    weatherLabel: string;
    windSpeed: number;
  };
  hourly: WeatherHour[];
}

export interface AuthStatus {
  envPasscodeConfigured: boolean;
  claimed: boolean;
  requiresSetup: boolean;
  authenticated: boolean;
  storageMode: 'supabase' | 'memory';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sourcesUsed?: string[];
  timestamp: string;
}
