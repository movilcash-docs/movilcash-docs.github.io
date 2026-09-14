# movilcash-docs.github.io

Wiki tipo Confluence, sin backend: SPA en React que usa una carpeta de Google Drive
como almacenamiento (páginas en Markdown, imágenes como assets).

## Desarrollo local

```bash
npm install
npm run dev
```

## Setup de Google Cloud (OAuth) — pendiente, a hacer manualmente

La app necesita un OAuth Client ID de Google para loguear al usuario y leer/escribir
en su Drive. Pasos en [Google Cloud Console](https://console.cloud.google.com/):

1. **Crear proyecto** (o reusar uno existente).
2. **Habilitar la API**: "APIs & Services" → "Library" → buscar **Google Drive API** → Enable.
   (Si se usa Google Picker para elegir la carpeta, habilitar también **Google Picker API**.)
3. **OAuth consent screen**:
   - User type: **External**, Publishing status: **Testing** (evita el proceso de
     verificación de Google mientras el uso sea interno/acotado a pocos usuarios).
   - Agregar como *Test users* las cuentas de Google que van a usar la wiki (en modo
     Testing, Google limita a 100 usuarios y los tokens expiran a los 7 días si la
     app no está verificada — revisar si esto es aceptable para el caso de uso).
   - Scopes a declarar: `https://www.googleapis.com/auth/drive`
     (necesario porque la app debe leer/escribir archivos que **no** fueron creados
     por ella misma — el scope `drive.file`, más acotado, no alcanza para esto).
4. **Crear credenciales** → **OAuth client ID** → tipo **Web application**:
   - *Authorized JavaScript origins*: `https://<tu-usuario-u-org>.github.io` y
     `http://localhost:5173` (para desarrollo local).
   - No hace falta *Authorized redirect URIs* (se usa el flujo de Google Identity
     Services basado en token, sin redirect).
5. Copiar el **Client ID** generado.

## Configurar el Client ID

- **Local**: copiar `.env.example` a `.env` y completar `VITE_GOOGLE_CLIENT_ID`.
- **Deploy (GitHub Actions)**: configurar una **repository variable** (no secret,
  el Client ID es público) llamada `VITE_GOOGLE_CLIENT_ID` en
  Settings → Secrets and variables → Actions → Variables.

## Estructura esperada en Google Drive

```
wiki/
├── index.md
├── arquitectura/
│   ├── index.md
│   ├── diagrama.png
│   └── aws.png
└── biometria/
    ├── index.md
    ├── facemesh.png
    └── liveness.png
```

Cada carpeta es una sección, cada `.md` una página, las imágenes son assets
referenciados con rutas relativas dentro del markdown.

## Deploy

Push a `main` dispara el workflow `.github/workflows/deploy.yml`, que buildea y
publica a GitHub Pages automáticamente. Hay que habilitar Pages con **Source:
GitHub Actions** en Settings → Pages del repo (paso manual, una sola vez).
