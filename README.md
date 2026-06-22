# Digital Business Cards — Panel de administración

Panel que **unifica dos proveedores** para gestionar tarjetas de presentación
digitales de la empresa:

- **[AddToWallet](https://app.addtowallet.co)** → crea los pases para Apple/Google Wallet.
- **[qr-code-generator](https://www.qr-code-generator.com) (qrco.de)** → genera un **QR dinámico** que apunta al pase.

Desde un solo formulario creas la tarjeta en ambos servicios, queda enlazada en
una base de datos local, y desde el panel administras grupos, reenvías el pase
por email y ves la analítica de escaneos.

## Cómo se conectan las dos cosas

```
Formulario  →  Backend orquestador
  1. AddToWallet: crea el pase            → passId + URL de instalación
  2. qrco.de: crea un QR DINÁMICO         → destino = URL del pase  → qrco.de/xxxx
  3. Guarda el vínculo en SQLite          (contacto · grupo · passId · qrId · links)
  4. (Opcional) Envía el pase por email
```

El QR es **dinámico**: el mismo código impreso puede seguir apuntando al pase
aunque cambie algo, y se obtiene analítica de escaneos.

## Estructura

```
server/   API Node + Express + SQLite (better-sqlite3)
  src/providers/   clientes de AddToWallet y qr-code-generator (modo mock/live)
  src/services/    orquestación de tarjetas + email
  src/routes/      endpoints REST
web/      Panel React + Vite
```

## Puesta en marcha

```bash
npm install                 # instala server + web (workspaces)
cp .env.example .env        # configura credenciales
npm run dev                 # API (4000) + panel (5173) a la vez
```

Abre http://localhost:5173

### Modo mock vs live

- `PROVIDER_MODE=mock` (por defecto): no llama a APIs reales, simula pases y QR.
  Ideal para desarrollar y ver el panel funcionando de inmediato.
- `PROVIDER_MODE=live`: usa AddToWallet + qr-code-generator reales. Requiere
  `ADDTOWALLET_API_KEY` y `QRCODE_API_KEY`.

## ⚠️ Pendiente para activar `live`

Las páginas de documentación de ambos proveedores están protegidas por Cloudflare
y no fue posible extraer el esquema exacto de la API automáticamente. Los clientes
en `server/src/providers/*.js` siguen la forma documentada públicamente; los puntos
exactos a confirmar con las **docs de tu cuenta premium** están marcados con
`// ⚙️ AJUSTAR` (formato del header de auth, rutas y nombres de campos de
request/response). Una vez ajustados, todo el resto del sistema funciona igual.

## Seguridad

- Las API keys viven **solo en el backend** (`.env`), nunca en el navegador.
- El panel/API se puede proteger con `ADMIN_TOKEN` (cabecera `x-admin-token`).
- `.env` y la base de datos `data/*.db` están en `.gitignore`.
