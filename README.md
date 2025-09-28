# Supabase Stock Repo (lista para clonar)

Estructura mínima con `public/index.html` como raíz (Vite se ejecuta con `--root public`).

## Archivos incluidos
- `public/index.html`
- `src/*` (React app)
- `sql/init.sql` (crea tabla y políticas RLS)
- `.env.example` (ejemplo de variables)
- `package.json`, `vite.config.js`(opcional)

## Instrucciones rápidas (local)
1. Copia `.env.example` a `.env` y pega tus valores reales:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
2. Ejecuta en la carpeta del proyecto:
   ```bash
   npm install
   npm run dev
   ```
3. En Supabase Dashboard -> SQL Editor ejecuta `sql/init.sql` para crear la tabla y políticas.
4. En Supabase -> Auth -> Users crea un usuario con email `jsnowoliv@gmail.com` (o cambia el email en las políticas).

## Deploy en Vercel (sin exponer keys)
1. Sube este repo a GitHub (o usa la subida manual por ZIP). 2. En Vercel crea un nuevo proyecto conectado al repo.
2. En Vercel **Project Settings -> Environment Variables** añade:
   - `VITE_SUPABASE_URL` = `https://...supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJ...`
3. En Vercel **Build & Output Settings** asegúrate de:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. En Vercel **General -> Root Directory** pon: `public` (porque usamos `--root public` en los scripts)
5. Deploy y listo.

## Notas de seguridad
- Nunca subas `service_role` key al cliente ni a GitHub.
- Ajusta las policies RLS según necesites (si quieres que solo usuarios autenticados lean, elimina la policy `public_select_products`).
