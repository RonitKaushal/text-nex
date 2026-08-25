import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDatabase,
  createJob,
  updateJob,
  appendLead,
  insertLeads,
  getJobs,
  getJobById,
  deleteJob,
} from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 39678;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

async function getScraper(source) {
  if (source === 'justdial') {
    const { runJustDialScraper } = await import('./scrapers/justDial.js');
    return runJustDialScraper;
  }
  const { runGoogleMapsScraper } = await import('./scrapers/googleMaps.js');
  return runGoogleMapsScraper;
}

function buildJobFromBody(body = {}) {
  const maxResults = Math.min(200, Math.max(1, parseInt(body.maxResults, 10) || 50));
  return {
    id: String(body.jobId || Date.now()),
    name: (body.name || body.keyword || 'Campaign').trim(),
    keyword: body.keyword || 'restaurants',
    location: (body.location || '').trim(),
    source: body.source || 'justdial',
    status: 'running',
    total_leads: 0,
    startTime: new Date().toISOString(),
    remoteId: body.remoteId || null,
    settings: {
      maxResultsPerSearch: maxResults,
      latitude: body.latitude != null ? Number(body.latitude) : undefined,
      longitude: body.longitude != null ? Number(body.longitude) : undefined,
    },
    results: [],
  };
}

/** List local campaigns */
app.get('/api/jobs', (_req, res) => {
  try {
    res.json(getJobs());
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

/** Campaign + leads */
app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.delete('/api/jobs/:id', (req, res) => {
  try {
    deleteJob(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.patch('/api/jobs/:id', (req, res) => {
  try {
    updateJob(req.params.id, req.body || {});
    const job = getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Run scrape and return full JSON (non-streaming). Persists locally.
app.post('/api/generate', async (req, res) => {
  const job = buildJobFromBody(req.body || {});
  const maxAllowed = job.settings.maxResultsPerSearch;
  createJob(job);
  const onProgress = (msg) => {
    console.log('[Lead Gen]', msg || `Leads so far: ${job.results.length}`);
  };
  try {
    console.log('[Lead Gen] Scrape started:', job.name, job.source, 'maxResults:', maxAllowed);
    const run = await getScraper(job.source === 'justdial' ? 'justdial' : 'google_maps');
    // Scrapers push into job.results themselves — onResult unused for persist-at-end path
    await run(job, null, onProgress);
    const cappedResults = job.results.slice(0, maxAllowed);
    insertLeads(0, cappedResults, job.id);
    updateJob(job.id, {
      status: 'completed',
      total_leads: cappedResults.length,
      endTime: new Date().toISOString(),
      error: null,
    });
    console.log('[Lead Gen] Scrape finished, total_leads:', cappedResults.length);
    res.json({ success: true, total: cappedResults.length, jobId: job.id, leads: cappedResults });
  } catch (err) {
    console.error('[Lead Gen] Scrape failed:', err?.message);
    updateJob(job.id, {
      status: 'failed',
      error: err?.message || String(err),
      endTime: new Date().toISOString(),
      total_leads: job.results.length,
    });
    res.status(500).json({ success: false, error: err?.message || String(err), jobId: job.id });
  }
});

// Stream scrape: meta → leads → done. Each lead saved locally as it arrives.
app.post('/api/generate-stream', async (req, res) => {
  const job = buildJobFromBody(req.body || {});
  const maxAllowed = job.settings.maxResultsPerSearch;
  createJob(job);

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders && res.flushHeaders();
  res.write(JSON.stringify({ type: 'meta', jobId: job.id }) + '\n');

  // Scraper pushes to job.results then calls onResult — only stream/persist here (no double-push).
  const writeLead = (r) => {
    if (job.results.length > maxAllowed) return;
    try {
      appendLead(job.id, r);
    } catch (e) {
      console.warn('[Lead Gen] appendLead failed:', e?.message || e);
    }
    res.write(JSON.stringify({ type: 'lead', ...r }) + '\n');
  };
  const onProgress = (msg) => {
    console.log('[Lead Gen]', msg || `Leads so far: ${job.results.length}`);
  };
  try {
    console.log('[Lead Gen] Stream scrape started:', job.name, job.source);
    const run = await getScraper(job.source === 'justdial' ? 'justdial' : 'google_maps');
    await run(job, writeLead, onProgress);
    const total = Math.min(job.results.length, maxAllowed);
    updateJob(job.id, {
      status: 'completed',
      total_leads: total,
      endTime: new Date().toISOString(),
      error: null,
    });
    res.write(JSON.stringify({ done: true, total, jobId: job.id }) + '\n');
    console.log('[Lead Gen] Stream scrape finished, total_leads:', total);
  } catch (err) {
    console.error('[Lead Gen] Stream scrape failed:', err?.message);
    updateJob(job.id, {
      status: 'failed',
      error: err?.message || String(err),
      endTime: new Date().toISOString(),
      total_leads: job.results.length,
    });
    res.write(JSON.stringify({ done: false, error: err?.message || String(err), jobId: job.id }) + '\n');
  }
  res.end();
});

const staticDir = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(staticDir));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(staticDir, 'index.html'));
});

export function startServer() {
  const dataDir = process.env.LEAD_GEN_DATA || path.join(__dirname, 'db');
  initDatabase(dataDir);
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log('[Lead Gen] App at http://localhost:' + PORT + ' (local DB: ' + dataDir + ')');
      resolve(PORT);
    });
  });
}
