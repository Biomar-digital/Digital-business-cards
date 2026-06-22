# Digital Business Cards — Panel de administración

Panel que **unifica dos proveedores** para gestionar tarjetas de presentación
digitales de la empresa:

- **[AddToWallet](https://app.addtowallet.co)** → crea los pases para Apple/Google Wallet.
- **[qr-code-generator](https://www.qr-code-generator.com) (qrco.de)** → genera un **QR dinámico** que apunta al pase.

Desde un solo formulario creas la tarjeta en ambos servicios, queda enlazada en
la base de datos, y desde el panel administras grupos, reenvías el pase por email
(vía **Brevo**) y ves la analítica de escaneos.

Desplegado **100% en Cloudflare**: Pages (frontend) + Pages Functions (API) + D1
(base de datos SQLite serverless), con deploy automático desde GitHub.

## Cómo se conectan las dos cosas

```
Formulario  →  Worker orquestador (Pages Functions)
  1. AddToWallet: crea el pase            → passId + URL de instalación
  2. qrco.de: crea un QR DINÁMICO         → destino = URL del pase  → qrco.de/xxxx
  3. Guarda el vínculo en D1              (contacto · grupo · passId · qrId · links)
  4. (Opcional) Envía el pase por email   (Brevo)
```

El QR es **dinámico**: el mismo código impreso puede seguir apuntando al pase
aunque cambie algo, y se obtiene analítica de escaneos.

## Estructura

```
functions/          Cloudflare Pages Functions (API)
  api/[[path]].js   rutas REST con Hono (cards, groups, health)
  _lib/
    config.js       configuración desde el entorno del Worker (env)
    cards.js        orquestación del flujo unificado sobre D1
    email.js        envío por Brevo (o distribución de AddToWallet)
    providers/      clientes de AddToWallet y qr-code-generator (mock/live)
web/                Panel React + Vite (se sirve como estático en Pages)
schema.sql          esquema de la base de datos D1
wrangler.toml       configuración de Pages + D1 + variables
```

## Desarrollo local

Requiere las herramientas de Cloudflare (`wrangler`, ya incluido como devDependency).

```bash
npm install                       # instala web + dependencias del Worker
cp .dev.vars.example .dev.vars     # rellena tus credenciales (gitignored)
npm run db:init                    # crea el esquema en la D1 LOCAL
npm run dev                        # compila el panel y lo sirve con la API en :8788
```

Abre http://localhost:8788

### Modo mock vs live

- `PROVIDER_MODE=mock` (por defecto): no llama a APIs reales, simula pases y QR.
  Ideal para desarrollar y ver el panel funcionando de inmediato.
- `PROVIDER_MODE=live`: usa AddToWallet + qr-code-generator reales. Requiere
  `ADDTOWALLET_API_KEY` y `QRCODE_API_KEY` (y `BREVO_API_KEY` para el email).

## Despliegue en Cloudflare

1. **Crea la base D1** y pega el `database_id` en `wrangler.toml`:
   ```bash
   npx wrangler d1 create dbc
   npm run db:init:remote          # aplica el esquema a la D1 de producción
   ```
2. **Conecta el repo** en Cloudflare → *Workers & Pages* → *Create* → *Pages* →
   *Connect to Git*. Build command: `npm run build`. Output dir: `web/dist`.
   (También puedes desplegar a mano con `npm run deploy`.)
3. **Bindea la D1** al proyecto Pages (Settings → Functions → D1 bindings):
   binding `DB` → base `dbc`.
4. **Configura las variables y secretos** del proyecto Pages
   (Settings → Environment variables). Las no secretas ya están en `wrangler.toml`
   (`PROVIDER_MODE`, `*_TEMPLATE_ID`, `EMAIL_FROM`…). Como **Secret**, añade:
   `ADMIN_TOKEN`, `ADDTOWALLET_API_KEY`, `QRCODE_API_KEY`, `BREVO_API_KEY`.
5. **Dominio**: añade tu dominio (p. ej. `tarjetas.biomar.digital`) en la pestaña
   *Custom domains* del proyecto Pages. Cloudflare gestiona DNS y SSL.

Cada `git push` a la rama configurada vuelve a desplegar automáticamente.

## Email con Brevo

El envío usa la **API HTTP de Brevo** (`POST https://api.brevo.com/v3/smtp/email`),
compatible con Cloudflare Workers (no hace falta SMTP). Configura `BREVO_API_KEY`
y `EMAIL_FROM` (formato `"Nombre <correo@dominio>"`, con el remitente verificado
en Brevo). Alternativa: `EMAIL_PROVIDER=addtowallet` para usar la distribución por
email del propio AddToWallet.

## ⚠️ Pendiente para activar `live`

Las páginas de documentación de AddToWallet y qr-code-generator están protegidas
por Cloudflare y no fue posible extraer el esquema exacto de la API automáticamente.
Los clientes en `functions/_lib/providers/*.js` siguen la forma documentada
públicamente; los puntos exactos a confirmar con las **docs de tu cuenta premium**
están marcados con `// ⚙️ AJUSTAR` (formato del header de auth, rutas y nombres de
campos de request/response). Una vez ajustados, todo el resto del sistema funciona
igual.

## Seguridad

- Las API keys viven **solo en el backend** (Secrets de Cloudflare / `.dev.vars`),
  nunca en el navegador.
- El panel/API se protege con `ADMIN_TOKEN` (cabecera `x-admin-token`); el frontend
  pide el token en una pantalla de login.
- `.dev.vars`, `.env` y `.wrangler/` están en `.gitignore`.
