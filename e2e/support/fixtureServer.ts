import http from 'node:http';

const defaultFixtureUserSettings = {
  autoLogCall: { value: true },
  autoLogSMS: { value: true },
  quickAccessButtonSize: { value: 'small' },
  showCalldownTab: { value: false },
  showUserReportTab: { value: false },
  showAppointmentsTab: { value: false },
  serverSideLogging: { enable: false },
};

export function startFixtureServer() {
  const requests = [];
  let fixtureUserSettings = defaultFixtureUserSettings;
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

    if (request.method === 'POST' && url.pathname === '/contact') {
      sendJson(response, {
        successful: true,
        contact: {
          id: 'e2e-created-contact-1',
          type: body?.newContactType ?? 'Lead',
          name: body?.newContactName ?? 'Created E2E Contact',
          phone: body?.phoneNumber,
          additionalInfo: {},
        },
        returnMessage: {
          messageType: 'success',
          message: 'Contact created',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/custom/contact/search') {
      sendJson(response, {
        successful: true,
        contact: [
          {
            id: 'e2e-search-contact-1',
            type: 'Contact',
            name: 'Alex Search',
            phone: '+16505550100',
            email: 'alex.search@example.com',
            createdDate: '2026-07-03T08:00:00Z',
            mostRecentActivityDate: '2026-07-04T08:00:00Z',
            additionalInfo: {},
          },
        ],
        returnMessage: {
          messageType: 'success',
          message: 'Contacts found',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/callLog') {
      if (url.searchParams.get('sessionIds') === 'e2e-existing-session-1') {
        sendJson(response, {
          successful: true,
          logs: [
            {
              matched: true,
              sessionId: 'e2e-existing-session-1',
              logId: 'e2e-existing-call-log-1',
              contact: {
                id: 'e2e-contact-1',
              },
            },
          ],
          returnMessage: {
            messageType: 'success',
            message: 'Existing call log matched',
            ttl: 3000,
          },
        });
        return;
      }
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

    if (request.method === 'PATCH' && url.pathname === '/callLog') {
      sendJson(response, {
        successful: true,
        returnMessage: {
          messageType: 'success',
          message: 'Call log updated',
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

    if (request.method === 'POST' && url.pathname === '/messageLog') {
      sendJson(response, {
        successful: true,
        logIds: ['e2e-message-log-1'],
        returnMessage: {
          messageType: 'success',
          message: 'Message log added',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/calldown') {
      sendJson(response, {
        items: [],
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/calldown') {
      sendJson(response, {
        successful: true,
        id: 'e2e-calldown-1',
        returnMessage: {
          messageType: 'success',
          message: 'Callback scheduled',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/appointments') {
      sendJson(response, {
        successful: true,
        appointments: [
          {
            id: 'e2e-appt-1',
            thirdPartyAppointmentId: 'e2e-appt-1',
            title: 'E2E appointment',
            status: 'scheduled',
            startTime: '2026-07-08T16:00:00Z',
            durationMinutes: 45,
            participantName: 'E2E Caller',
            contactId: 'e2e-contact-1',
            contactType: 'Lead',
            contactName: 'E2E Caller',
          },
        ],
        returnMessage: {
          messageType: 'success',
          message: 'Appointments loaded',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/appointments') {
      sendJson(response, {
        successful: true,
        appointmentId: 'e2e-created-appt-1',
        appointment: {
          id: 'e2e-created-appt-1',
          ...body,
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment created',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'PATCH' && url.pathname === '/appointments/e2e-appt-1') {
      sendJson(response, {
        successful: true,
        appointmentId: 'e2e-appt-1',
        appointment: {
          id: 'e2e-appt-1',
          ...body,
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment updated',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/appointments/e2e-appt-1/status') {
      sendJson(response, {
        successful: true,
        appointmentId: 'e2e-appt-1',
        appointment: {
          id: 'e2e-appt-1',
          status: body?.status,
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment status updated',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/appointments/e2e-appt-1/confirm') {
      sendJson(response, {
        successful: true,
        appointmentId: 'e2e-appt-1',
        appointment: {
          id: 'e2e-appt-1',
          status: 'confirmed',
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment confirmed',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/appointments/e2e-appt-1/cancel') {
      sendJson(response, {
        successful: true,
        appointmentId: 'e2e-appt-1',
        appointment: {
          id: 'e2e-appt-1',
          status: 'canceled',
        },
        returnMessage: {
          messageType: 'success',
          message: 'Appointment canceled',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/oauth-callback') {
      sendJson(response, {
        successful: true,
        jwtToken: 'e2e-oauth-jwt',
        name: 'E2E CRM User',
        returnMessage: {
          messageType: 'success',
          message: 'Authorized',
          ttl: 3000,
        },
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/admin/settings') {
      sendJson(response, null);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/implementedInterfaces') {
      sendJson(response, {});
      return;
    }

    if (request.method === 'GET' && url.pathname === '/user/settings') {
      sendJson(response, fixtureUserSettings);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/user/settings') {
      sendJson(response, {
        userSettings: body?.userSettings ?? {},
      });
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
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Fixture server did not bind to a TCP port'));
        return;
      }
      const { port } = address;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        requests,
        clearRequests: () => {
          requests.length = 0;
        },
        setUserSettings: (overrides = {}) => {
          fixtureUserSettings = {
            ...defaultFixtureUserSettings,
            ...overrides,
          };
        },
        close: () => new Promise<void>((closeResolve, closeReject) => {
          server.close((error) => (error ? closeReject(error) : closeResolve()));
        }),
      });
    });
  });
}
