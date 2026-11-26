# Botica Atlas — Red de Farmacias, Higiene y Cuidado Personal

Sistema web dinámico para consultar farmacias, disponibilidad de productos de higiene y cuidado personal, mapa interactivo con **OpenStreetMap** sincronizado en tiempo real con **Google Maps**, pronóstico meteorológico de **24 horas** (Open-Meteo) y asistente inteligente con **Gemini**.

## Arquitectura y Seguridad

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Leaflet (OpenStreetMap).
- **Backend**: Express (`server.ts`) encargado de:
  - Proteger las claves privadas (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSCODE`) exclusivamente en el servidor.
  - Controlar permisos de escritura (`POST`, `PUT`, `DELETE`) mediante tokens firmados con HMAC-SHA256.
  - Consultar el clima en tiempo real desde Open-Meteo (`/api/weather`).
  - Ejecutar el asistente Gemini con *Function Calling* conectado al catálogo en vivo (`/api/chat`).
- **Base de datos**: Supabase (PostgreSQL) mediante `@supabase/supabase-js` en el servidor.

## Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Abre el **SQL Editor** y ejecuta el contenido de `supabase/schema.sql`.
3. En **Project Settings → API**, copia `Project URL` (`SUPABASE_URL`) y `service_role` (`SUPABASE_SERVICE_ROLE_KEY`).
4. Al iniciar el servidor por primera vez con las variables configuradas, la tabla se inicializará automáticamente con 6 farmacias y 18 productos si se encuentra vacía.

## Variables de entorno

Configura en tu panel de Render o en las variables de entorno del servidor:

- `GEMINI_API_KEY`: Clave de API de Google Gemini.
- `SUPABASE_URL`: URL del proyecto en Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Clave `service_role` de Supabase (nunca exponer al cliente).
- `ADMIN_PASSCODE`: Clave maestra de administración (si se omite, la primera persona administradora puede configurarla desde la interfaz).

## Despliegue en GitHub y Render

1. Sube este repositorio a GitHub.
2. En [Render](https://render.com), selecciona **New + → Blueprint** (usando `render.yaml`) o **Web Service**.
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Agrega las variables de entorno en Render y despliega.
