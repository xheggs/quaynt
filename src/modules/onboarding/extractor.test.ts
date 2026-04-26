import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { extractSite, ExtractSiteError } from './extractor';

const SAAS_HTML = `<!DOCTYPE html><html><head>
  <title>Acme Analytics — Real-time observability for product teams</title>
  <meta property="og:site_name" content="Acme Analytics" />
  <meta property="og:title" content="Acme Analytics" />
  <meta property="og:description" content="Acme helps product teams understand what users actually do." />
  <meta name="description" content="Real-time analytics for product teams." />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "Organization",
      "name": "Acme Analytics", "alternateName": ["Acme", "Acme HQ"],
      "legalName": "Acme Analytics, Inc.", "knowsAbout": ["Product analytics", "Session replay"] }
  </script>
</head><body>
  <h1>Acme Analytics</h1>
  <h2>Product analytics</h2>
  <h2>Session replay</h2>
  <h2>Funnels</h2>
  <nav><a>Pricing</a><a>Customers</a></nav>
</body></html>`;

const ECOMMERCE_HTML = `<!DOCTYPE html><html><head>
  <title>Bloom Florists | Same-day delivery</title>
  <meta property="og:title" content="Bloom Florists" />
  <meta name="description" content="Bouquets and arrangements delivered same-day in NYC." />
</head><body><h1>Welcome to Bloom Florists</h1></body></html>`;

const SPA_HTML = `<!DOCTYPE html><html><head>
  <meta property="og:site_name" content="Carbide" />
  <meta property="og:description" content="A workspace for industrial designers." />
</head><body><div id="root"></div></body></html>`;

const REDIRECT_HTML = `<!DOCTYPE html><html><head>
  <title>Drift</title>
</head><body></body></html>`;

const ABOUT_HTML = `<!DOCTYPE html><html><head>
  <title>About Acme</title>
</head><body><h1>Our story</h1></body></html>`;

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/saas') return html(res, SAAS_HTML);
    if (url === '/saas/about') return html(res, ABOUT_HTML);
    if (url === '/ecom') return html(res, ECOMMERCE_HTML);
    if (url === '/spa') return html(res, SPA_HTML);
    if (url === '/redirected') return html(res, REDIRECT_HTML);
    if (url === '/redirect-once') {
      res.writeHead(302, { Location: '/redirected' });
      res.end();
      return;
    }
    if (url === '/non-html') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }
    if (url === '/missing') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  // no-op
});

function html(res: import('node:http').ServerResponse, body: string) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

const allowAll = () => false;

describe('extractSite', () => {
  it('extracts SaaS brand from og + JSON-LD signals', async () => {
    const result = await extractSite(`http://127.0.0.1:${port}/saas`, { ipFilter: allowAll });
    expect(result.brandName).toBe('Acme Analytics');
    expect(result.aliases).toEqual(
      expect.arrayContaining(['Acme', 'Acme HQ', 'Acme Analytics, Inc.'])
    );
    expect(result.description).toContain('product teams');
    expect(result.categories).toEqual(
      expect.arrayContaining(['Product analytics', 'Session replay'])
    );
  });

  it('falls back to og:title and strips site suffix for e-commerce', async () => {
    const result = await extractSite(`http://127.0.0.1:${port}/ecom`, { ipFilter: allowAll });
    expect(result.brandName).toBe('Bloom Florists');
    expect(result.description).toContain('Bouquets');
  });

  it('handles SPA shell with og tags only', async () => {
    const result = await extractSite(`http://127.0.0.1:${port}/spa`, { ipFilter: allowAll });
    expect(result.brandName).toBe('Carbide');
    expect(result.description).toContain('industrial designers');
  });

  it('throws on 404', async () => {
    await expect(
      extractSite(`http://127.0.0.1:${port}/missing`, { ipFilter: allowAll })
    ).rejects.toBeInstanceOf(ExtractSiteError);
  });

  it('rejects non-HTML responses', async () => {
    await expect(
      extractSite(`http://127.0.0.1:${port}/non-html`, { ipFilter: allowAll })
    ).rejects.toMatchObject({ code: 'non_html_response' });
  });

  it('follows redirects on the same host', async () => {
    const result = await extractSite(`http://127.0.0.1:${port}/redirect-once`, {
      ipFilter: allowAll,
    });
    expect(result.brandName).toBe('Drift');
  });
});
