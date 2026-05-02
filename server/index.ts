import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchEbayMarket } from './ebay';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'popvalue-api' });
});

app.post('/api/ebay/search', async (request, response) => {
  const result = await searchEbayMarket(request.body);
  response.status(result.status).json(result.payload);
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) {
      next();
      return;
    }

    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`PopValue running on http://localhost:${port}`);
});
