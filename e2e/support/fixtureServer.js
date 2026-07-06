const http = require('http');

function startFixtureServer() {
  const requests = [];
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>App Connect E2E Host</title>
  </head>
  <body>
    <main>
      <h1>App Connect E2E Host</h1>
      <p id="contact-phone">Contact phone: +1 (650) 555-0100</p>
    </main>
  </body>
</html>`;

  function sendJson(response, body) {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }

  async function readBody(request) {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    if (!rawBody) {
      return null;
    }
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const body = await readBody(request);
    requests.push({
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    });

    if (request.method === 'GET' && url.pathname === '/contact') {
      sendJson(response, {
        successful: true,
        contact: [
          {
            id: 'e2e-contact-1',
            type: 'Lead',
            name: 'E2E Caller',
            phone: url.searchParams.get('phoneNumber'),
            createdDate: '2026-07-01T08:00:00Z',
            mostRecentActivityDate: '2026-07-02T08:00:00Z',
            additionalInfo: {},
          },
        ],
        returnMessage: {
          messageType: 'success',
          message: 'Contact matched',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/callLog') {
      sendJson(response, {
        successful: true,
        logs: [],
        returnMessage: {
          messageType: 'success',
          message: 'No existing call logs',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/callLog') {
      sendJson(response, {
        successful: true,
        logId: 'e2e-call-log-1',
        returnMessage: {
          messageType: 'success',
          message: 'Call log added',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/implementedInterfaces') {
      sendJson(response, {});
      return;
    }

    if (request.method === 'GET' && url.pathname === '/user/settings') {
      sendJson(response, {
        autoLogCall: { value: true },
        quickAccessButtonSize: { value: 'small' },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/user/settings') {
      sendJson(response, body?.userSettings ?? {});
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(html);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => (error ? closeReject(error) : closeResolve()));
        }),
      });
    });
  });
}

module.exports = {
  startFixtureServer,
};
