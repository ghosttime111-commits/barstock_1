# BarStock

BarStock — серверное приложение TanStack Start для переучётов, списаний,
перемещений и контроля ресторанных остатков.

## Локальный запуск

```powershell
npm install
npm run dev
```

## Production-проверка

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
```

PWA генерируется только при production-сборке. Стратегия кеширования, установка,
offline fallback и проверка обновлений описаны в [docs/PWA.md](docs/PWA.md).

Инструкция деплоя на Vercel находится в [DEPLOY.md](DEPLOY.md).
