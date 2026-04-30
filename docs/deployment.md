# Deployment Notes

FunkScan has two runtime pieces:

- Vite frontend served from the production `dist` build.
- Express API in `server/index.ts` for eBay token minting and marketplace search.

Because the API needs private eBay credentials, do not deploy it as client-side code and do not expose secrets with `VITE_` environment variable names.

## Recommended: Full-stack Host

Use a platform that can run a Node server and serve static assets, such as Render, Railway, or Fly.io.

Set these environment variables in the host dashboard:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_OAUTH_SCOPE`
- `EBAY_MARKETPLACE_ID`
- `EBAY_API_BASE_URL`
- `EBAY_ENABLE_SOLD_LOOKUP`
- `PORT`, if the host requires it

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
NODE_ENV=production npm start
```

In production mode, the Express server serves the built `dist` directory and keeps `/api/*` routes available from the same origin.

## Split Deployment

Use a static host for the frontend and a Node host for the API.

Frontend:

- Build with `npm run build`.
- Publish `dist`.
- Configure the frontend to call the hosted API URL instead of relying on the Vite dev proxy.

Backend:

- Deploy `server/index.ts` on a Node-capable host.
- Configure eBay environment variables server-side only.
- Allow the frontend origin with CORS.

## Static Demo Only

GitHub Pages can serve the built frontend, but live eBay lookups will not work without a hosted API. This is fine for a mock-data demo, but not for the full product.
