/**
 * The HTML served at `/` to browsers.
 *
 * Built once at import time rather than per request — nothing here varies by
 * caller, so there is no reason to re-concatenate it on every hit.
 *
 * Two constraints from the global helmet shape this page, and both are worth
 * knowing before editing it:
 *
 *   - `script-src 'self'` rejects inline scripts, so the page carries no
 *     JavaScript at all. Anything interactive would need a served file.
 *   - `style-src` includes `'unsafe-inline'` in helmet's defaults, which is why
 *     the stylesheet can live in a `<style>` block without the CSP relaxation
 *     that /docs needs.
 *
 * `img-src 'self' data:` is what lets the favicon be an inline data URI, which
 * saves a round trip and a route.
 */

const REPO_URL = 'https://github.com/jkkma/job-board-api';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  auth: string;
  summary: string;
}

interface EndpointGroup {
  name: string;
  blurb: string;
  endpoints: Endpoint[];
}

/**
 * Mirrors the tags and summaries in `openapi.ts`. Kept as data rather than
 * hand-written markup so a new route is one row, not a block of `<tr>`s.
 */
const groups: EndpointGroup[] = [
  {
    name: 'Auth',
    blurb: 'Registration, login, and the current session.',
    endpoints: [
      { method: 'POST', path: '/auth/register', auth: 'Public', summary: 'Create an account' },
      {
        method: 'POST',
        path: '/auth/login',
        auth: 'Public',
        summary: 'Exchange credentials for a token',
      },
      { method: 'GET', path: '/auth/me', auth: 'Token', summary: 'The current user' },
    ],
  },
  {
    name: 'Jobs',
    blurb: 'Reading is public; writing is EMPLOYER only.',
    endpoints: [
      {
        method: 'GET',
        path: '/jobs',
        auth: 'Public',
        summary: 'Paginated listings, filterable and sortable',
      },
      { method: 'GET', path: '/jobs/:id', auth: 'Public', summary: 'Fetch one job' },
      { method: 'POST', path: '/jobs', auth: 'Employer', summary: 'Create a job' },
      { method: 'PUT', path: '/jobs/:id', auth: 'Owner', summary: 'Update a job' },
      { method: 'DELETE', path: '/jobs/:id', auth: 'Owner', summary: 'Delete a job' },
    ],
  },
  {
    name: 'Applications',
    blurb: 'Applying to jobs and reviewing applicants.',
    endpoints: [
      { method: 'POST', path: '/applications', auth: 'Applicant', summary: 'Apply to a job' },
      {
        method: 'GET',
        path: '/applications/my',
        auth: 'Token',
        summary: 'The caller’s own applications',
      },
      {
        method: 'GET',
        path: '/applications/job/:id',
        auth: 'Owner',
        summary: 'Applications for one of your jobs',
      },
      {
        method: 'PATCH',
        path: '/applications/:id/status',
        auth: 'Owner',
        summary: 'Accept or reject an applicant',
      },
    ],
  },
];

const healthEndpoints: Endpoint[] = [
  { method: 'GET', path: '/health', auth: 'Public', summary: 'Liveness, does no I/O' },
  {
    method: 'GET',
    path: '/health/ready',
    auth: 'Public',
    summary: 'Readiness, pings the database',
  },
];

/**
 * Escapes the five characters that matter in HTML text and attributes.
 *
 * Everything rendered here is a compile-time constant, so this is belt and
 * braces rather than a live defence — but it means a future endpoint summary
 * containing an angle bracket cannot quietly break the markup.
 */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderRow = ({ method, path, auth, summary }: Endpoint): string => `
          <tr>
            <td><span class="method method-${method.toLowerCase()}">${method}</span></td>
            <td><code>${escapeHtml(path)}</code></td>
            <td><span class="auth">${escapeHtml(auth)}</span></td>
            <td>${escapeHtml(summary)}</td>
          </tr>`;

const renderGroup = ({ name, blurb, endpoints }: EndpointGroup): string => `
      <section class="group">
        <h3>${escapeHtml(name)}</h3>
        <p class="blurb">${escapeHtml(blurb)}</p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Method</th><th>Path</th><th>Auth</th><th>Description</th></tr>
            </thead>
            <tbody>${endpoints.map(renderRow).join('')}
            </tbody>
          </table>
        </div>
      </section>`;

const styles = `
    :root {
      color-scheme: light dark;
      --bg: #fbfbfa;
      --surface: #ffffff;
      --surface-alt: #f4f4f1;
      --text: #1a1a19;
      --muted: #6b6b66;
      --border: #e3e3de;
      --accent: #4f46e5;
      --accent-contrast: #ffffff;
      --get: #1d4ed8;
      --get-bg: #e5edff;
      --post: #047857;
      --post-bg: #dcfce7;
      --put: #b45309;
      --put-bg: #fef3c7;
      --delete: #b91c1c;
      --delete-bg: #fee2e2;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f1115;
        --surface: #161920;
        --surface-alt: #1c202a;
        --text: #e9e9e6;
        --muted: #9b9b95;
        --border: #272b35;
        --accent: #a5b4fc;
        --accent-contrast: #12121a;
        --get: #93b4fd;
        --get-bg: #1e2a44;
        --post: #6ee7b7;
        --post-bg: #10332a;
        --put: #fcd34d;
        --put-bg: #3a2d0c;
        --delete: #fca5a5;
        --delete-bg: #3d1d1d;
      }
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 3rem 1.5rem 4rem;
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    main { max-width: 52rem; margin: 0 auto; }

    code, pre {
      font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 0.875em;
    }

    a { color: var(--accent); }

    .eyebrow {
      margin: 0 0 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--muted);
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 6vw, 2.75rem);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .lede {
      margin: 0.75rem 0 0;
      font-size: 1.125rem;
      color: var(--muted);
      max-width: 40rem;
    }

    .stack {
      margin: 1rem 0 0;
      font-size: 0.875rem;
      color: var(--muted);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 2rem;
    }

    .btn {
      display: inline-block;
      padding: 0.6rem 1.15rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9375rem;
      font-weight: 500;
      text-decoration: none;
      transition: border-color 0.15s ease, transform 0.15s ease;
    }

    .btn:hover { border-color: var(--accent); transform: translateY(-1px); }

    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-contrast);
    }

    .btn-primary:hover { border-color: var(--accent); }

    h2 {
      margin: 3.5rem 0 0.25rem;
      font-size: 1.25rem;
      letter-spacing: -0.01em;
    }

    h3 {
      margin: 2rem 0 0.25rem;
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .blurb { margin: 0 0 0.75rem; font-size: 0.9375rem; color: var(--muted); }

    .section-note { margin: 0 0 1rem; color: var(--muted); font-size: 0.9375rem; }

    pre {
      margin: 0;
      padding: 1rem 1.15rem;
      border: 1px solid var(--border);
      border-radius: 0.625rem;
      background: var(--surface);
      overflow-x: auto;
      line-height: 1.7;
    }

    .table-scroll {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 0.625rem;
      background: var(--surface);
    }

    table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }

    th {
      padding: 0.6rem 0.9rem;
      background: var(--surface-alt);
      border-bottom: 1px solid var(--border);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      white-space: nowrap;
    }

    td {
      padding: 0.6rem 0.9rem;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    tbody tr:last-child td { border-bottom: none; }

    td code { color: var(--text); white-space: nowrap; }

    .method {
      display: inline-block;
      min-width: 4.25rem;
      padding: 0.15rem 0.45rem;
      border-radius: 0.3rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-align: center;
    }

    .method-get { color: var(--get); background: var(--get-bg); }
    .method-post { color: var(--post); background: var(--post-bg); }
    .method-put, .method-patch { color: var(--put); background: var(--put-bg); }
    .method-delete { color: var(--delete); background: var(--delete-bg); }

    .auth { color: var(--muted); font-size: 0.875rem; white-space: nowrap; }

    .creds {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .cred {
      padding: 0.9rem 1.1rem;
      border: 1px solid var(--border);
      border-radius: 0.625rem;
      background: var(--surface);
    }

    .cred .role {
      display: block;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.3rem;
    }

    .note {
      margin-top: 1rem;
      padding: 0.9rem 1.1rem;
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 0.5rem;
      background: var(--surface);
      font-size: 0.9375rem;
      color: var(--muted);
    }

    footer {
      margin-top: 4rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.875rem;
      color: var(--muted);
    }

    footer p { margin: 0.35rem 0; }

    @media (max-width: 34rem) {
      body { padding: 2rem 1rem 3rem; }
      .actions .btn { flex: 1 1 100%; text-align: center; }
    }`;

// A rounded-square glyph rather than a letterform: it stays legible at 16px in
// a tab strip, where anything with fine detail turns to mush.
const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234f46e5'/%3E%3Cpath d='M9 12h14M9 16h14M9 20h8' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E";

/**
 * Stands in for the origin the page is being served from, so the copyable curl
 * commands point at whatever host the reader actually reached — localhost in
 * development, the Render URL in production — instead of a baked-in guess.
 */
const ORIGIN_PLACEHOLDER = '__ORIGIN__';

const template = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Job Board API</title>
  <meta name="description" content="REST API where employers post jobs, applicants apply, and employers accept or reject. TypeScript, Express 5, Prisma, PostgreSQL.">
  <link rel="icon" href="${favicon}">
  <style>${styles}
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">REST API &middot; v1</p>
      <h1>Job Board API</h1>
      <p class="lede">Employers post jobs, applicants apply, employers accept or reject the applications they receive.</p>
      <p class="stack">TypeScript &middot; Express 5 &middot; Prisma &middot; PostgreSQL &middot; JWT with role-based access control</p>
      <nav class="actions">
        <a class="btn btn-primary" href="/docs">Interactive docs</a>
        <a class="btn" href="/openapi.json">OpenAPI spec</a>
        <a class="btn" href="${REPO_URL}">Source on GitHub</a>
      </nav>
    </header>

    <h2>Try it</h2>
    <p class="section-note">Every route lives under <code>/api/v1</code>. Reading jobs needs no credentials at all.</p>
    <pre><code># A page of open positions
curl ${ORIGIN_PLACEHOLDER}/api/v1/jobs

# Log in, then send the token as: Authorization: Bearer &lt;token&gt;
curl -X POST ${ORIGIN_PLACEHOLDER}/api/v1/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"hire@acme.com","password":"password123"}'</code></pre>

    <h2>Demo accounts</h2>
    <p class="section-note">Seeded on every deploy, both with the password <code>password123</code>. The seed is idempotent, so these stay valid.</p>
    <ul class="creds">
      <li class="cred"><span class="role">Employer</span><code>hire@acme.com</code></li>
      <li class="cred"><span class="role">Applicant</span><code>ada@example.com</code></li>
    </ul>
    <p class="note">The hosted demo runs on Render's free tier, so its instance sleeps after about 15 minutes idle. The first request after that takes roughly 30&ndash;50 seconds while it wakes &mdash; later ones are fast.</p>

    <h2>Endpoints</h2>
    <p class="section-note">The full interactive reference, with request and response schemas, is at <a href="/docs">/docs</a>.</p>
${groups.map(renderGroup).join('\n')}

      <section class="group">
        <h3>Health</h3>
        <p class="blurb">Probes, served outside <code>/api/v1</code> &mdash; they are infrastructure, not part of the API contract.</p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Method</th><th>Path</th><th>Auth</th><th>Description</th></tr>
            </thead>
            <tbody>${healthEndpoints.map(renderRow).join('')}
            </tbody>
          </table>
        </div>
      </section>

    <h2>Errors</h2>
    <p class="section-note">Every failure returns the same envelope. Branch on <code>code</code>, never on <code>message</code>.</p>
    <pre><code>{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [{ "path": "password", "message": "Password must be at least 8 characters" }]
  }
}</code></pre>

    <footer>
      <p>This page is what a browser gets. Request <code>Accept: application/json</code> and <code>/</code> returns the JSON discovery document instead.</p>
      <p>MIT licensed &middot; <a href="${REPO_URL}">github.com/jkkma/job-board-api</a></p>
    </footer>
  </main>
</body>
</html>
`;

/**
 * Renders the page for one request.
 *
 * `origin` reaches here from the Host header, which is client-controlled even
 * behind a proxy, so it is escaped like any other untrusted string. A forged
 * Host only ever produces a wrong-looking URL for the client that sent it —
 * nothing is stored — but escaping keeps it from being markup either way.
 */
export const renderLandingPage = (origin: string): string =>
  template.replaceAll(ORIGIN_PLACEHOLDER, escapeHtml(origin));
