import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { checkRobots } from './robots';

let robotsBody: string | null = null;
let robotsStatus = 200;

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/robots.txt') {
      if (robotsBody === null) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(robotsStatus, { 'Content-Type': 'text/plain' });
      res.end(robotsBody);
      return;
    }
    res.writeHead(200);
    res.end('ok');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  robotsBody = null;
  robotsStatus = 200;
  vi.restoreAllMocks();
});

describe('checkRobots', () => {
  it.each([
    // [robots body, path, expectedAllowed]
    ['', '/', true],
    ['User-agent: *\nAllow: /', '/', true],
    ['User-agent: *\nDisallow: /', '/', false],
    ['User-agent: *\nDisallow: /private/', '/public', true],
    ['User-agent: *\nDisallow: /private/', '/private/page', false],
    ['User-agent: Quaynt-Onboarding\nDisallow: /\nUser-agent: *\nAllow: /', '/', false],
    ['User-agent: Googlebot\nDisallow: /\n', '/', true],
    ['# comment\nUser-agent: *\nDisallow: /admin\n', '/admin/users', false],
    ['User-agent: *\nDisallow: /private\nAllow: /private/public', '/private/public/x', true],
    ['User-agent: *\nDisallow: /*.pdf$', '/file.pdf', false],
  ])('parser %#: returns allowed=%s for path %s', async (body, path, expectedAllowed) => {
    robotsBody = body;
    const result = await checkRobots(`http://127.0.0.1:${port}`, path, { ipFilter: () => false });
    expect(result.allowed).toBe(expectedAllowed);
  });

  it('treats 404 robots.txt as allowed', async () => {
    robotsBody = null;
    robotsStatus = 404;
    const result = await checkRobots(`http://127.0.0.1:${port}`, '/', { ipFilter: () => false });
    expect(result).toMatchObject({ allowed: true, reason: 'no_robots' });
  });
});
