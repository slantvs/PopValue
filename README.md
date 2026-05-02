# PopValue

PopValue is a React and Express MVP for estimating Funko Pop values. It can scan or upload a box image, match likely figures, compare eBay listings and retail references, and save collection entries in browser storage.

## Local Setup

Requirements:

- Node.js 24
- npm 11

Install dependencies:

```bash
npm ci
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Then fill in eBay credentials if you want live API lookups. The `.env` file is ignored by Git and should stay private.

If your eBay App ID or Cert ID contains `SBX`, those are sandbox credentials. Use sandbox credentials only with:

```bash
EBAY_API_BASE_URL=https://api.sandbox.ebay.com
```

For real marketplace listings, use production eBay credentials with:

```bash
EBAY_API_BASE_URL=https://api.ebay.com
```

## Run Locally

Start the client and API together:

```bash
npm run dev
```

Local URLs:

- App: http://localhost:5173
- API health: http://localhost:8787/api/health

The app falls back to mock data when eBay credentials are not configured.

## Public Demo

Full-stack Vercel deployment:

https://popvalue.vercel.app

GitHub Pages publishes the static frontend here:

https://slantvs.github.io/PopValue/

The GitHub Pages build points at the Vercel API through `VITE_API_BASE_URL`.

## Scripts

- `npm run dev` starts the Vite app and Express API.
- `npm run dev:client` starts only the Vite app.
- `npm run dev:server` starts only the Express API.
- `npm start` starts the Express API and serves `dist` when `NODE_ENV=production`.
- `npm test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run build` type-checks and builds the app.
- `npm run preview` previews the production build.

## Environment

Server-only environment variables live in `.env`:

- `EBAY_ACCESS_TOKEN` can be used for a short-lived app token.
- `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` let the server mint app tokens.
- `EBAY_MARKETPLACE_ID` defaults to `EBAY_US`.
- `EBAY_API_BASE_URL` defaults to `https://api.ebay.com`; use `https://api.sandbox.ebay.com` with `SBX` sandbox credentials.
- `EBAY_ENABLE_SOLD_LOOKUP` should only be enabled after Marketplace Insights access is approved.
- `PORT` defaults to `8787`.
- `VITE_API_BASE_URL` points the browser app at a hosted API when the frontend is deployed separately.

Do not prefix secrets with `VITE_`; that would expose them to the browser bundle.
Do not commit `.env`, screenshots of credentials, or eBay Cert IDs. If a Client Secret/Cert ID is shared publicly, rotate it in the eBay developer portal before using it.

## Deployment

GitHub Pages can host the frontend only, but this project also needs an API host for live eBay lookups. Recommended path:

- Vercel for the Vite frontend and `/api` serverless functions.
- Render, Railway, or Fly.io for a full-stack Node deployment.
- Static frontend on Netlify or GitHub Pages plus the Express API on Render, Railway, or Fly.io.
- Mock-only static demo if live marketplace lookups are not needed.

See [docs/deployment.md](docs/deployment.md) for the tradeoffs.

## CI

GitHub Actions runs `npm ci`, `npm test`, and `npm run build` on pushes and pull requests to `main`.
