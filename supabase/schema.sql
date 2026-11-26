-- Esquema PostgreSQL para Supabase — Botica Atlas
-- Ejecutar este archivo en el SQL Editor de Supabase antes de iniciar la aplicación.

create extension if not exists "pgcrypto";

create table if not exists public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  neighborhood text not null default '',
  contact text not null,
  hours text not null,
  is_24h boolean not null default false,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  name text not null,
  brand text not null default '',
  category text not null,
  presentation text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  available boolean not null default true,
  description text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_pharmacy_id on public.products(pharmacy_id);
create index if not exists idx_products_category on public.products(category);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Seguridad a nivel de fila (RLS)
alter table public.pharmacies enable row level security;
alter table public.products enable row level security;
alter table public.app_settings enable row level security;

-- Lectura pública para el catálogo y mapa; escrituras controladas por el servidor (service_role)
drop policy if exists "Lectura publica farmacias" on public.pharmacies;
create policy "Lectura publica farmacias"
  on public.pharmacies for select
  using (true);

drop policy if exists "Lectura publica productos" on public.products;
create policy "Lectura publica productos"
  on public.products for select
  using (true);

-- app_settings solo accesible mediante service_role desde el servidor Express
drop policy if exists "Sin acceso publico settings" on public.app_settings;
create policy "Sin acceso publico settings"
  on public.app_settings for all
  using (false);

-- Eliminar cualquier registro anterior de México/CDMX si existiera y cargar datos iniciales en Paraguay
delete from public.pharmacies where neighborhood ilike '%CDMX%';

-- Datos iniciales en Paraguay (6 farmacias y 18 productos de higiene y cuidado personal)
insert into public.pharmacies (id, name, address, neighborhood, contact, hours, is_24h, latitude, longitude, created_at)
values
  ('11111111-1111-4111-8111-111111111101', 'Botica Palma Centro', 'Calle Palma 540, Microcentro', 'Asunción, Paraguay', '+595 21 442 810', 'Lun–Sáb 07:30–21:30 · Dom 09:00–19:00', false, -25.2819, -57.6366, '2026-01-10T09:00:00Z'),
  ('11111111-1111-4111-8111-111111111102', 'Farmacia Villa Morra 24h', 'Av. Mariscal López 3794, Villa Morra', 'Asunción, Paraguay', '+595 21 608 420', 'Abierta 24 horas', true, -25.2943, -57.5818, '2026-01-11T09:00:00Z'),
  ('11111111-1111-4111-8111-111111111103', 'FarmaSalud Paseo Carmelitas', 'Av. España 1245 c/ Senador Long, Carmelitas', 'Asunción, Paraguay', '+595 21 612 305', 'Lun–Dom 07:00–23:00', false, -25.2856, -57.5712, '2026-01-12T09:00:00Z'),
  ('11111111-1111-4111-8111-111111111104', 'Botica San Lorenzo', 'Av. Mcal. Estigarribia 1420, Centro', 'San Lorenzo, Central', '+595 21 582 914', 'Abierta 24 horas', true, -25.3408, -57.5086, '2026-01-13T09:00:00Z'),
  ('11111111-1111-4111-8111-111111111105', 'Farmacia Paraná Este', 'Av. San Blas 720, Microcentro', 'Ciudad del Este, Alto Paraná', '+595 61 504 210', 'Lun–Sáb 07:30–21:00 · Dom 08:30–18:00', false, -25.5097, -54.6111, '2026-01-14T09:00:00Z'),
  ('11111111-1111-4111-8111-111111111106', 'Botica Costanera Sur', 'Av. Irrazábal 890 c/ Constitución', 'Encarnación, Itapúa', '+595 71 203 650', 'Lun–Dom 08:00–22:00', false, -27.3306, -55.8667, '2026-01-15T09:00:00Z')
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  neighborhood = excluded.neighborhood,
  contact = excluded.contact,
  hours = excluded.hours,
  is_24h = excluded.is_24h,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

insert into public.products (id, pharmacy_id, name, brand, category, presentation, price, stock, available, description, image_url, updated_at)
values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'Protector Solar Facial FPS 50+ Toque Seco', 'La Roche-Posay', 'Protección Solar', '50 ml', 185000, 18, true, 'Fluido invisible de muy alta protección UVA/UVB para piel mixta a grasa, resistente al agua.', '/src/assets/images/cat_sunscreen_care_1795699195259.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102', 'Protector Solar Mineral Fluido FPS 50', 'Soléil Derma', 'Protección Solar', '100 ml', 165000, 12, true, 'Filtros 100% minerales sin perfume para pieles sensibles y reactivas.', '/src/assets/images/cat_sunscreen_care_1795699195259.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111103', 'Bruma Protectora Solar Corporal FPS 50', 'ISDIN', 'Protección Solar', '200 ml', 210000, 4, true, 'Aplicación continua sobre piel seca o mojada con acabado ligero sin residuo blanco.', '/src/assets/images/cat_sunscreen_care_1795699195259.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111105', 'Protector Solar Pediátrico FPS 50+', 'Avène', 'Protección Solar', '150 ml', 175000, 0, false, 'Leche solar suave sin alcohol ni fragancia formulada para uso infantil.', '/src/assets/images/cat_sunscreen_care_1795699195259.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111104', 'Protector Solar Urbano Gel-Crema FPS 50+', 'Eucerin', 'Protección Solar', '50 ml', 158000, 9, true, 'Control de brillo diario con L-carnitina y protección contra luz visible.', '/src/assets/images/cat_sunscreen_care_1795699195259.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111101', 'Agua Micelar Limpiadora Dermatológica', 'Bioderma', 'Cuidado Facial', '250 ml', 132000, 22, true, 'Desmaquilla y limpia impurezas urbanas respetando la barrera cutánea.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222207', '11111111-1111-4111-8111-111111111102', 'Crema Hidratante Facial con Ceramidas', 'CeraVe', 'Cuidado Facial', '52 ml', 118000, 15, true, 'Hidratación de liberación prolongada con ácido hialurónico y tres ceramidas esenciales.', '/src/assets/images/cat_sunscreen_care_1795699195259.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222208', '11111111-1111-4111-8111-111111111103', 'Sérum Antioxidante Vitamina C 15%', 'Botica Lab', 'Cuidado Facial', '30 ml', 245000, 6, true, 'Concentrado iluminador con ácido L-ascórbico puro y ácido hialurónico.', '/src/assets/images/cat_hair_skin_care_1795699198284.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222209', '11111111-1111-4111-8111-111111111101', 'Jabón Líquido Botánico para Manos', 'Botanical Apothecary', 'Higiene Corporal', '473 ml', 78000, 27, true, 'Fórmula biodegradable con cedro, bergamota y glicerina vegetal hidratante.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222210', '11111111-1111-4111-8111-111111111104', 'Gel Limpiador Corporal Syndet Sin Jabón', 'Eucerin', 'Higiene Corporal', '400 ml', 128000, 11, true, 'pH balanceado 5.0 para higiene diaria de piel seca o con tendencia atópica.', '/src/assets/images/cat_hair_skin_care_1795699198284.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222211', '11111111-1111-4111-8111-111111111105', 'Desodorante Roll-On Mineral Sin Aluminio', 'Vichy', 'Higiene Corporal', '50 ml', 89000, 19, true, 'Protección de 48 horas con minerales calmantes apto para piel recién depilada.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222212', '11111111-1111-4111-8111-111111111106', 'Loción Corporal Calmante con Avena y Ceramidas', 'Aveeno', 'Higiene Corporal', '400 ml', 105000, 8, true, 'Restaura la hidratación después del baño con textura de rápida absorción.', '/src/assets/images/cat_hair_skin_care_1795699198284.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222213', '11111111-1111-4111-8111-111111111102', 'Pasta Dental Remineralizante Flúor + Menta', 'Oral Hygiene Lab', 'Higiene Bucal', '75 ml', 38000, 30, true, 'Protección de esmalte y aliento fresco sin lauril sulfato de sodio.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222214', '11111111-1111-4111-8111-111111111106', 'Cepillo Dental Suave Bambú + Hilo Dental', 'EcoDent', 'Higiene Bucal', 'Kit 2 piezas', 44000, 3, true, 'Cerdas ultrafinas de carbón vegetal e hilo encerado de menta natural.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222215', '11111111-1111-4111-8111-111111111103', 'Shampoo Dermatológico Suave Sin Sulfatos', 'Klorane', 'Cuidado Capilar', '250 ml', 115000, 14, true, 'Con extracto de avena y pantenol para uso frecuente en cuero cabelludo sensible.', '/src/assets/images/cat_hair_skin_care_1795699198284.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222216', '11111111-1111-4111-8111-111111111105', 'Shampoo Anticaspa Equilibrante Piroctona', 'Dercos', 'Cuidado Capilar', '200 ml', 142000, 0, false, 'Controla la descamación y calma la picazón desde la primera semana.', '/src/assets/images/cat_hair_skin_care_1795699198284.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222217', '11111111-1111-4111-8111-111111111104', 'Gel Antiséptico de Manos con Aloe 70%', 'MedCare', 'Botiquín e Higiene', '250 ml', 26000, 42, true, 'Desinfección rápida sin resequedad, ideal para llevar en mochila o bolsillo.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z'),
  ('22222222-2222-4222-8222-222222222218', '11111111-1111-4111-8111-111111111106', 'Solución Salina Estéril Spray Nasal', 'Stérimar', 'Botiquín e Higiene', '100 ml', 68000, 16, true, 'Higiene nasal diaria con agua de mar isotónica microdifundida.', '/src/assets/images/cat_hygiene_essentials_1795699197258.jpg', '2026-02-01T10:00:00Z')
on conflict (id) do update set
  pharmacy_id = excluded.pharmacy_id,
  name = excluded.name,
  brand = excluded.brand,
  category = excluded.category,
  presentation = excluded.presentation,
  price = excluded.price,
  stock = excluded.stock,
  available = excluded.available,
  description = excluded.description,
  image_url = excluded.image_url,
  updated_at = excluded.updated_at;

