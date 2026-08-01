# Yhozen · GameJam 2026

Base de trabajo para el juego de **@Yhozen**. Es una aplicación web de canvas,
hecha con JavaScript y Vite, sin framework ni servicios externos.

## Desarrollo

Requiere Node.js 20.19 o posterior (el Cloud Computer de Conductor ya incluye
Node.js 24).

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 3000
```

En Conductor Cloud, agrega el puerto `3000` en **Workspace details → Forward
ports** y abre el puerto local que Conductor asigne.

## Verificación

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 3000
```

El resultado de producción queda en `dist/` (ignorado por Git).

## Setup de nuevos workspaces Cloud

En **Settings → Organization → Cloud Computer → gamejam-2026 → Setup script**,
usa este comando:

```bash
bash participantes/yhozen/scripts/setup.sh
```

No hace falta modificar **Install software** ni reconstruir el Cloud Computer:
el runtime necesario ya viene en la imagen base. Guardar el Setup script lo
aplica a los próximos workspaces; en el workspace actual basta con ejecutar
`./participantes/yhozen/scripts/setup.sh` desde la raíz del repositorio.

## Límite del trabajo

Todo el código del juego se mantiene dentro de `participantes/yhozen/`, tal
como exige el README principal de la jam.
