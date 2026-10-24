import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import crypto from 'node:crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const runtimeProvider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini-optional' : 'demo');
const runtimeModel = process.env.RUNTIME_AGENT_MODEL || (process.env.GEMINI_API_KEY ? 'gemini-3.8-flash-optional' : 'deterministic-demo-0b');
const appUrl = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const sessionSecret = process.env.SESSION_SECRET || 'synora-development-session-secret-change-me';
const oauthProviders = ['google', 'github', 'microsoft'] as const;
type OAuthProvider = typeof oauthProviders[number];

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/runtime-info', (_req: Request, res: Response) => {
  res.json({
    provider: runtimeProvider,
    model: runtimeModel,
    coreAgentMode: runtimeProvider === 'demo' ? 'demonstration' : 'optional-provider',
    modelConstraint: 'Core runtime model must be open-weight and <=8B parameters when deployed.',
    configured: Boolean(process.env.GEMINI_API_KEY || process.env.OPEN_WEIGHT_MODEL_ENDPOINT),
  });
});

function configuredOAuth(provider: OAuthProvider): boolean {
  const prefix = provider === 'google' ? 'GOOGLE' : provider === 'github' ? 'GITHUB' : 'MICROSOFT';
  return Boolean(process.env[`${prefix}_CLIENT_ID`] && process.env[`${prefix}_CLIENT_SECRET`]);
}

function providerStatus(provider: OAuthProvider) {
  const configured = configuredOAuth(provider);
  const label = provider === 'github' ? 'GitHub' : `${provider[0].toUpperCase()}${provider.slice(1)}`;
  return {
    configured,
    canStart: configured,
    callbackPath: `/auth/${provider}/callback`,
    message: configured ? 'Ready to start authentication.' : `${label} is not configured on the server.`,
  };
}

function setCookie(res: Response, name: string, value: string, maxAge = 600): void {
  const secure = appUrl.startsWith('https://') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function oauthState(provider: OAuthProvider): string {
  return `${provider}.${Date.now()}.${crypto.randomBytes(18).toString('hex')}`;
}

function setNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
}

function redirectAuthError(res: Response, reason: 'cancelled' | 'failed' | 'unavailable'): void {
  const query = new URLSearchParams({ auth: reason });
  res.redirect(`${appUrl}/?${query.toString()}`);
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 8000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function createSignedSession(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readSignedSession(value?: string): Record<string, unknown> | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

app.get('/api/auth/health', (_req: Request, res: Response) => {
  setNoStore(res);
  res.json({
    service: 'available',
    appUrl,
    providers: Object.fromEntries(oauthProviders.map(provider => [provider, providerStatus(provider)])),
  });
});

app.get('/api/auth/providers', (_req: Request, res: Response) => {
  setNoStore(res);
  res.json({
    service: 'available',
    providers: Object.fromEntries(oauthProviders.map(provider => [provider, providerStatus(provider)])),
  });
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  setNoStore(res);
  const session = readSignedSession(getCookie(req, 'synora_session'));
  res.json(session ? { authenticated: true, user: session } : { authenticated: false });
});

app.get('/auth/:provider', (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  if (!oauthProviders.includes(provider) || !configuredOAuth(provider)) {
    return redirectAuthError(res, 'unavailable');
  }
  const state = oauthState(provider);
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  setCookie(res, 'synora_oauth_state', state, 600);
  setCookie(res, 'synora_oauth_verifier', verifier, 600);
  const callback = encodeURIComponent(`${appUrl}/auth/${provider}/callback`);
  const prefix = provider === 'google' ? 'GOOGLE' : provider === 'github' ? 'GITHUB' : 'MICROSOFT';
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const authorizeUrl = provider === 'google'
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId!)}&redirect_uri=${callback}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`
    : provider === 'github'
    ? `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId!)}&redirect_uri=${callback}&scope=${encodeURIComponent('read:user user:email')}&state=${encodeURIComponent(state)}`
    : `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId!)}&redirect_uri=${callback}&response_type=code&scope=${encodeURIComponent('openid profile email User.Read')}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
  return res.redirect(authorizeUrl);
});

app.get('/auth/:provider/callback', async (req: Request, res: Response) => {
  const provider = req.params.provider as OAuthProvider;
  if (!oauthProviders.includes(provider) || !configuredOAuth(provider)) return redirectAuthError(res, 'unavailable');
  if (req.query.error === 'access_denied' || req.query.error === 'cancel') return redirectAuthError(res, 'cancelled');
  const state = String(req.query.state || '');
  const storedState = getCookie(req, 'synora_oauth_state');
  const verifier = getCookie(req, 'synora_oauth_verifier');
  const code = String(req.query.code || '');
  const stateParts = state.split('.');
  const issuedAt = Number(stateParts[1]);
  if (!storedState || storedState !== state || !state.startsWith(`${provider}.`) || !Number.isFinite(issuedAt) || Date.now() - issuedAt > 10 * 60 * 1000 || !code) {
    return redirectAuthError(res, 'failed');
  }

  try {
    const prefix = provider === 'google' ? 'GOOGLE' : provider === 'github' ? 'GITHUB' : 'MICROSOFT';
    const clientId = process.env[`${prefix}_CLIENT_ID`]!;
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]!;
    const redirectUri = `${appUrl}/auth/${provider}/callback`;
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    const tokenUrl = provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : provider === 'github'
      ? 'https://github.com/login/oauth/access_token'
      : `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
    const tokenResponse = await fetchWithTimeout(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code', ...(provider !== 'github' && verifier ? { code_verifier: verifier } : {}) }),
    });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) throw new Error('Provider token exchange failed.');
    const userUrl = provider === 'google' ? 'https://openidconnect.googleapis.com/v1/userinfo' : provider === 'github' ? 'https://api.github.com/user' : 'https://graph.microsoft.com/v1.0/me';
    const userResponse = await fetchWithTimeout(userUrl, { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' } });
    const profile = await userResponse.json() as { id?: string; sub?: string; email?: string; login?: string; name?: string };
    if (!userResponse.ok) throw new Error('Provider profile lookup failed.');
    if (provider === 'github' && !profile.email) {
      const emailResponse = await fetchWithTimeout('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json' } });
      const emails = await emailResponse.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
      profile.email = emails.find(email => email.primary && email.verified)?.email || emails.find(email => email.verified)?.email;
    }
    const sessionPayload = createSignedSession({ provider, subject: profile.id || profile.sub, email: profile.email, name: profile.name || profile.login, issuedAt: Date.now() });
    setCookie(res, 'synora_oauth_state', '', 0);
    setCookie(res, 'synora_oauth_verifier', '', 0);
    setCookie(res, 'synora_session', sessionPayload, 60 * 60 * 8);
    return res.redirect(`${appUrl}/?auth=success`);
  } catch (error: any) {
    console.error('OAuth sign-in failed:', error?.message || 'provider error');
    return redirectAuthError(res, 'failed');
  }
});

app.post('/auth/logout', (_req: Request, res: Response) => {
  setCookie(res, 'synora_session', '', 0);
  setNoStore(res);
  res.json({ ok: true, message: 'Session ended.' });
});

// Initialize Gemini SDK with server-side API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: AI-assisted natural-language SQL generation
app.post('/api/generate-sql', async (req: Request, res: Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Optional model provider is not configured. Use the local deterministic demo agent or configure a compatible provider.' });
    }
    const { question, schemas } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const prompt = `You are a strict, read-only SQL engineer for an in-memory database.
Available Schemas:
${JSON.stringify(schemas, null, 2)}

User Question: "${question}"

Rules:
1. Generate ONLY ONE valid SQLite/AlaSQL SELECT statement (or WITH ... SELECT).
2. NEVER generate DROP, INSERT, UPDATE, DELETE, ALTER, CREATE, ATTACH, PRAGMA.
3. Use the exact table IDs and column names provided in the schema.
4. Clean strings with commas if needed (e.g. CAST(REPLACE(col, ',', '') AS INT)).
5. Respond ONLY with raw SQL code. No markdown fences, no explanation, no backticks.`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: prompt,
    });

    let sql = response.text?.trim() || '';
    sql = sql.replace(/^```(sql)?\s*/i, '').replace(/```$/i, '').trim();

    return res.json({ sql });
  } catch (err: any) {
    console.error('Error generating SQL:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate SQL' });
  }
});

// Endpoint: AI Grounded Question Answering
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Optional model provider is not configured. SYNORA remains available in local grounded demo mode.' });
    }
    const { question, context, style = 'professional' } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const systemInstruction = `You are DataLens 3D — a grounded AI Data Analyst Agent.
CLOSED-WORLD POLICY:
- You must answer EXCLUSIVELY using the provided context, verified SQL results, and document excerpts.
- NEVER use external web knowledge, public websites, or unverified facts.
- If the uploaded data does not contain enough evidence, explicitly output:
  "I cannot determine this from the uploaded data." followed by what specific table, column, or document record is missing.
- When referencing numbers or trends, cite the exact numbers from the context.
- Never invent evaluation scores, criteria, citations or calculations. Distinguish supplied ratings from independently computed measurements.
- For recommendation questions, use this EXACT output structure:
  1. Direct recommendation in the very first sentence.
  2. Three or four key reasons (under ### Key Reasons).
  3. Comparison with the strongest alternative (under ### Comparison with Strongest Alternative).
  4. Important constraints, trade-offs and safety requirements (under ### Constraints, Trade-Offs, and Safety Requirements).
  5. Exact citations to the uploaded source files and section/page (under ### Source Provenance & Citations).
  6. A brief statement of assumptions or missing evidence if relevant (under ### Assumptions and Missing Evidence).
- Keep tone ${style}.`;

    const contents = `Context from user workspace:
${JSON.stringify(context, null, 2)}

User Question:
"${question}"

Provide a thorough, grounded answer with references to the specific table, sheet, column, or document excerpt.`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [{ text: systemInstruction + '\n\n' + contents }] },
      ],
    });

    return res.json({ answer: response.text });
  } catch (err: any) {
    console.error('Error in chat endpoint:', err);
    return res.status(500).json({ error: err.message || 'AI grounding error' });
  }
});

// Endpoint: Multimodal OCR / Table Extraction from images
app.post('/api/ocr', async (req: Request, res: Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'OCR provider is not configured. The image will be retained with an honest extraction warning.' });
    }
    const { base64, filename } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'Image base64 data required' });
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this image document or table.
If it contains a data table, extract all rows as a JSON array of objects where keys are column headers.
If it contains text, summarize or transcribe all visible text accurately.
Output JSON format:
{
  "extractedText": "full visible text...",
  "extractedTable": [ {"col1": "val", "col2": "val"} ]
}`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    });

    let raw = response.text?.trim() || '{}';
    raw = raw.replace(/^```(json)?\s*/i, '').replace(/```$/i, '').trim();

    try {
      const parsed = JSON.parse(raw);
      return res.json(parsed);
    } catch {
      return res.json({ extractedText: response.text, extractedTable: [] });
    }
  } catch (err: any) {
    console.error('OCR Error:', err);
    return res.status(500).json({ error: err.message || 'OCR processing failed' });
  }
});

// Endpoint: Document Extraction for PDF & binary documents
app.post('/api/extract-document', async (req: Request, res: Response) => {
  try {
    const { base64, filename, fileType } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'Document base64 data required' });
    }

    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');

    if (fileType === 'pdf') {
      try {
        const parser = new PDFParse({ data: Buffer.from(cleanBase64, 'base64') });
        const parsed = await parser.getText();
        await parser.destroy();
        const pageText = parsed.pages
          .map(page => `=== Page ${page.num} ===\n${page.text.trim()}`)
          .filter(section => section.length > 16)
          .join('\n\n');
        if (pageText.trim()) {
          return res.json({ extractedText: pageText, pageCount: parsed.total, extractionMethod: 'text-parser' });
        }
      } catch (parserError) {
        console.warn(`Local PDF extraction failed for ${filename}:`, parserError);
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(422).json({ error: 'No readable PDF text was found. This may be a scanned PDF; configure GEMINI_API_KEY or another OCR provider for image-only pages.' });
      }
      const prompt = `You are a precision document text extractor for DataLens 3D.
Extract all text from this PDF file with maximal factual fidelity.
Rules:
1. Clearly preserve headings, sections, and page references (e.g. "=== Page 1 ===" or "## Section: Experiment Title").
2. Extract all experiment titles, objectives, procedures, equipment requirements, safety notes, time/complexity, prerequisites, and findings.
3. If there are tables or lists, format them clearly with Markdown.
4. Output the raw transcribed markdown text directly without introductory conversational fluff.`;

      const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
      });

       return res.json({ extractedText: response.text || '', extractionMethod: 'model-fallback', warning: 'Local text extraction found no readable text; model-assisted extraction was used.' });
    }

    return res.json({ extractedText: '' });
  } catch (err: any) {
    console.error('Extract Document Error:', err);
    return res.status(500).json({ error: err.message || 'Document extraction failed' });
  }
});

// Mount Vite or serve static
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(PORT);
  app.listen(port, '0.0.0.0', () => {
    console.log(`DataLens 3D server running on port ${port}`);
  });
}

startServer();
