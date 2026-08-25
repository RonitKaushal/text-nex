import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbPath = null;
let data = { companies: [], leads: [], jobs: [] };

function load() {
  if (!dbPath) return;
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    data.companies = Array.isArray(parsed.companies) ? parsed.companies : [];
    data.leads = Array.isArray(parsed.leads) ? parsed.leads : [];
    data.jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch (_) {
    data = { companies: [], leads: [], jobs: [] };
  }
}

function save() {
  if (!dbPath) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 0), 'utf8');
  } catch (err) {
    console.error('[Lead Gen] DB save failed:', err?.message || err);
  }
}

function normalizeLead(l, jobId, companyId = 0) {
  return {
    name: l.name || l.business_name || null,
    address: l.address || null,
    phone: l.phone || null,
    email: l.email || null,
    website: l.website || null,
    url: l.url || l.google_maps_url || l.mapsUrl || null,
    rating: l.rating ?? null,
    review_count: l.reviewCount ?? l.reviewsCount ?? l.reviews ?? null,
    category: l.category || null,
    source: l.source || null,
    keyword: l.keyword || null,
    location: l.location || null,
    job_id: jobId ?? l.job_id ?? null,
    company_id: companyId,
  };
}

export function initDatabase(userDataPath) {
  const dir = userDataPath || path.join(__dirname, 'db');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, 'leadgen.json');
  load();
  console.log('[Lead Gen] Local DB:', dbPath);
  return true;
}

export function getDb() {
  return dbPath ? data : null;
}

export function createCompany(email, passwordHash, companyName) {
  load();
  const existing = data.companies.find((c) => c.email === email);
  if (existing) return null;
  const id = data.companies.length ? Math.max(...data.companies.map((c) => c.id)) + 1 : 1;
  data.companies.push({
    id,
    email,
    password_hash: passwordHash,
    company_name: companyName || null,
    created_at: new Date().toISOString(),
  });
  save();
  return id;
}

export function getCompanyByEmail(email) {
  load();
  return data.companies.find((c) => c.email === email) || null;
}

export function insertLeads(companyId, leads, jobId = null) {
  load();
  const lastId = data.leads.length ? Math.max(...data.leads.map((l) => l.id)) : 0;
  const now = new Date().toISOString();
  leads.forEach((l, i) => {
    const n = normalizeLead(l, jobId, companyId ?? 0);
    data.leads.push({
      id: lastId + i + 1,
      ...n,
      created_at: now,
    });
  });
  if (jobId) {
    const job = data.jobs.find((j) => String(j.id) === String(jobId));
    if (job) {
      job.total_leads = data.leads.filter((l) => String(l.job_id) === String(jobId)).length;
    }
  }
  save();
}

/** Append one lead and bump job.total_leads (for live scrape). */
export function appendLead(jobId, lead, companyId = 0) {
  load();
  const lastId = data.leads.length ? Math.max(...data.leads.map((l) => l.id)) : 0;
  const n = normalizeLead(lead, jobId, companyId);
  data.leads.push({
    id: lastId + 1,
    ...n,
    created_at: new Date().toISOString(),
  });
  const job = data.jobs.find((j) => String(j.id) === String(jobId));
  if (job) {
    job.total_leads = (job.total_leads || 0) + 1;
    if (job.status === 'queued') job.status = 'running';
  }
  save();
  return lastId + 1;
}

export function getLeads(companyId) {
  load();
  return data.leads
    .filter((l) => l.company_id === companyId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getLeadsCount(companyId) {
  load();
  return data.leads.filter((l) => l.company_id === companyId).length;
}

export function createJob(job) {
  load();
  const id = String(job.id || Date.now());
  const existing = data.jobs.findIndex((j) => String(j.id) === id);
  const rec = {
    id,
    name: job.name,
    source: job.source,
    keyword: job.keyword,
    location: job.location || '',
    status: job.status || 'running',
    total_leads: job.total_leads || 0,
    startTime: job.startTime || new Date().toISOString(),
    endTime: job.endTime || null,
    error: job.error || null,
    settings: job.settings || {},
    remoteId: job.remoteId || null,
  };
  if (existing >= 0) data.jobs[existing] = { ...data.jobs[existing], ...rec };
  else data.jobs.unshift(rec);
  save();
  return id;
}

export function updateJob(id, update) {
  load();
  const i = data.jobs.findIndex((j) => String(j.id) === String(id));
  if (i === -1) return;
  data.jobs[i] = { ...data.jobs[i], ...update };
  save();
}

export function getJobs() {
  load();
  return [...data.jobs];
}

export function mapLeadForApi(l) {
  return {
    id: l.id,
    business_name: l.name,
    name: l.name,
    address: l.address,
    phone: l.phone,
    website: l.website,
    google_maps_url: l.url,
    url: l.url,
    rating: l.rating,
    reviews: l.review_count,
    reviewsCount: l.review_count,
    category: l.category,
    email: l.email,
  };
}

export function getJobById(id) {
  load();
  const job = data.jobs.find((j) => String(j.id) === String(id));
  if (!job) return null;
  const results = data.leads
    .filter((l) => String(l.job_id) === String(id))
    .map(mapLeadForApi);
  return { ...job, results };
}

export function deleteJob(id) {
  load();
  data.jobs = data.jobs.filter((j) => String(j.id) !== String(id));
  data.leads = data.leads.filter((l) => String(l.job_id) !== String(id));
  save();
}
