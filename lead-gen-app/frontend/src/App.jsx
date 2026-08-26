import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Dropdown,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  DownloadOutlined,
  GlobalOutlined,
  KeyOutlined,
  PhoneOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';

/** Same API base as ArcticSwitch */
const TEXTNEXUS_API = (import.meta.env.VITE_API_URL || 'https://api.textnexus.in/api').replace(/\/$/, '');
const LOCAL_API = 'http://127.0.0.1:39678/api';
const DEFAULT_LOCATION = 'Ahmedabad, Gujarat, India';

const APP_BG_GRADIENT =
  'radial-gradient(ellipse 120% 80% at 35% -10%, #102038 0%, #070d16 48%, #050910 100%)';
const FONT_FAMILY = "'Gilroy', system-ui, sans-serif";
const PRIMARY = '#8b7cf6';
const APP_BORDER = '#1a2a3d';
const APP_BG_ELEVATED = '#122033';

const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: PRIMARY,
    borderRadius: 12,
    fontFamily: FONT_FAMILY,
    colorBgContainer: '#0a1524',
    colorBgElevated: APP_BG_ELEVATED,
    colorBorder: APP_BORDER,
    colorText: '#eef3f8',
    colorTextSecondary: '#9aa8b8',
  },
  components: {
    Card: { colorBgContainer: '#0a1524' },
    Table: { colorBgContainer: 'transparent', headerBg: 'rgba(10, 21, 36, 0.9)' },
    Input: { colorBgContainer: 'rgba(8, 16, 28, 0.65)' },
    Drawer: { colorBgElevated: '#0b1420' },
  },
};

function getApiBase() {
  return (
    localStorage.getItem('leadgen_backendUrl') ||
    localStorage.getItem('backendUrl') ||
    TEXTNEXUS_API
  ).replace(/\/$/, '');
}

function downloadCsv(filename, rows) {
  const safe = (v) => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const headers = rows && rows.length ? Object.keys(rows[0]) : [];
  const csv = [headers.map(safe).join(','), ...(rows || []).map((r) => headers.map((h) => safe(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LOGIN_FEATURES = [
  {
    icon: <SearchOutlined />,
    title: 'Generate leads',
    body: 'JustDial & Google Maps scraping runs on your PC for speed.',
  },
  {
    icon: <AppstoreOutlined />,
    title: 'Campaigns synced',
    body: 'Campaigns and leads sync with the same ArcticSwitch server.',
  },
  {
    icon: <SyncOutlined />,
    title: 'Lead Gen license',
    body: 'Use your phone number and Lead Gen license key (not Text Next / Bulk WhatsApp keys).',
  },
];

const LEAD_GEN_APP_TYPE = 'lead-gen';
const LG_TOKEN_KEY = 'leadgen_accessToken';
const LG_REFRESH_KEY = 'leadgen_refreshToken';
const LG_USER_KEY = 'leadgen_user';
const LG_BACKEND_KEY = 'leadgen_backendUrl';

function readLeadGenToken() {
  return localStorage.getItem(LG_TOKEN_KEY) || localStorage.getItem('accessToken');
}

function readLeadGenUser() {
  const raw = localStorage.getItem(LG_USER_KEY) || localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearLeadGenAuth() {
  localStorage.removeItem(LG_TOKEN_KEY);
  localStorage.removeItem(LG_REFRESH_KEY);
  localStorage.removeItem(LG_USER_KEY);
  localStorage.removeItem(LG_BACKEND_KEY);
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('backendUrl');
}

function saveLeadGenAuth({ accessToken, refreshToken, user, backendUrl }) {
  localStorage.setItem(LG_BACKEND_KEY, backendUrl || TEXTNEXUS_API);
  localStorage.setItem('backendUrl', backendUrl || TEXTNEXUS_API);
  localStorage.setItem(LG_TOKEN_KEY, accessToken);
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) {
    localStorage.setItem(LG_REFRESH_KEY, refreshToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
  localStorage.setItem(LG_USER_KEY, JSON.stringify(user));
  localStorage.setItem('user', JSON.stringify(user));
}

function assertLeadGenUser(user) {
  const type = String(user?.type || '').trim().toLowerCase() || 'text-next';
  if (type !== LEAD_GEN_APP_TYPE) {
    const label =
      type === 'text-next' ? 'Text Next' : type === 'bulk-whatsapp' ? 'Bulk WhatsApp' : type;
    throw new Error(
      `This license key is for ${label}. Use a Lead Gen license key.`
    );
  }
}

/** Lead Gen login: phone + Lead Gen license → POST /user/login-license */
function KeyLogin({ onLogin }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState('idle');
  const [licenseError, setLicenseError] = useState(null);

  const licenseBorder = useMemo(() => {
    if (licenseStatus === 'valid') return '#52c41a';
    if (licenseStatus === 'invalid') return '#ff4d4f';
    return 'rgba(255,255,255,0.18)';
  }, [licenseStatus]);

  const licenseGlow =
    licenseStatus === 'valid'
      ? '0 0 0 3px rgba(82, 196, 26, 0.22)'
      : licenseStatus === 'invalid'
        ? '0 0 0 3px rgba(255, 77, 79, 0.18)'
        : 'none';

  const fieldStyle = {
    height: 48,
    borderRadius: 12,
    background: 'rgba(8, 16, 28, 0.65)',
    border: '1.5px solid rgba(255,255,255,0.18)',
    color: '#f0f4f8',
    boxShadow: 'none',
  };

  const handleConnect = async (values) => {
    setLoading(true);
    setLicenseStatus('idle');
    setLicenseError(null);
    try {
      const phone = String(values.phone || '').trim();
      const licenseKey = String(values.licenseKey || '').trim();
      const res = await fetch(`${TEXTNEXUS_API}/user/login-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          phone,
          deviceType: 'software',
          appType: 'lead-gen',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Login failed');
      }
      const accessToken = data.token || data.accessToken;
      const refreshToken = data.refreshToken;
      const user = { ...(data.user || {}), phone: phone || data.user?.phone };
      if (!accessToken) throw new Error('Login failed — no token');
      assertLeadGenUser(user);

      saveLeadGenAuth({
        accessToken,
        refreshToken,
        user: { ...user, type: user.type || LEAD_GEN_APP_TYPE },
        backendUrl: TEXTNEXUS_API,
      });

      setLicenseStatus('valid');
      message.success('Login successful!');
      window.setTimeout(
        () => onLogin({ user: { ...user, type: user.type || LEAD_GEN_APP_TYPE }, accessToken }),
        420
      );
    } catch (err) {
      const msg = err.message || 'Login failed. Please check your connection.';
      setLicenseStatus('invalid');
      setLicenseError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: APP_BG_GRADIENT,
        padding: '32px 24px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,124,246,0.16) 0%, transparent 68%)',
          top: '28%',
          left: '38%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="tn-login-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 1040,
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 48,
          alignItems: 'center',
        }}
      >
        <div className="tn-login-brand" style={{ padding: '8px 12px' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              marginBottom: 28,
              background: 'linear-gradient(135deg, #a99bf8, #6f5ee0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 36px ${PRIMARY}44`,
              color: '#fff',
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            LG
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(32px, 4vw, 44px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#fff',
            }}
          >
            Lead generation.
            <br />
            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>
              One license.
            </span>
          </h1>

          <div
            className="tn-login-features"
            style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {LOGIN_FEATURES.map((f) => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: APP_BG_ELEVATED,
                    border: `1px solid ${APP_BORDER}`,
                    color: PRIMARY,
                    fontSize: 16,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ color: '#f0f4f8', fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                    {f.title}
                  </div>
                  <div style={{ color: '#9aa8b8', fontSize: 13, lineHeight: 1.45 }}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 40,
              fontSize: 12,
              color: 'rgba(255,255,255,0.38)',
              letterSpacing: 0.2,
            }}
          >
            Lead Gen · ArcticSwitch Pro
          </div>
        </div>

        <div
          className="tn-login-card"
          style={{
            background: 'rgba(12, 24, 40, 0.72)',
            border: `1px solid ${APP_BORDER}`,
            borderRadius: 22,
            padding: '36px 32px 32px',
            boxShadow:
              '0 0 0 1px rgba(139,124,246,0.12), 0 24px 60px rgba(0,0,0,0.45), 0 0 80px rgba(139,124,246,0.08)',
            backdropFilter: 'blur(14px)',
            animation: 'tnLoginCardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}
            >
              Get started
            </div>
            <Typography.Text style={{ fontSize: 14, color: '#9aa8b8', lineHeight: 1.5 }}>
              Enter your phone number and Lead Gen license key to continue.
            </Typography.Text>
          </div>

          <Form
            form={form}
            name="lead-gen-login"
            onFinish={handleConnect}
            layout="vertical"
            requiredMark={false}
            onValuesChange={(changed) => {
              if ('licenseKey' in changed && licenseStatus !== 'idle') {
                setLicenseStatus('idle');
                setLicenseError(null);
              }
            }}
          >
            <Form.Item
              name="phone"
              label={
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
                  Phone
                </span>
              }
              rules={[{ required: true, message: 'Please enter your phone number' }]}
              style={{ marginBottom: 18 }}
            >
              <Input
                size="large"
                placeholder="Your phone number"
                prefix={<PhoneOutlined style={{ color: '#7a8796' }} />}
                style={fieldStyle}
              />
            </Form.Item>

            <Form.Item
              name="licenseKey"
              label={
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
                  License key
                </span>
              }
              rules={[{ required: true, message: 'Please enter your license key' }]}
              validateStatus={
                licenseStatus === 'invalid'
                  ? 'error'
                  : licenseStatus === 'valid'
                    ? 'success'
                    : undefined
              }
              help={
                licenseStatus === 'invalid'
                  ? licenseError
                  : licenseStatus === 'valid'
                    ? 'License verified'
                    : undefined
              }
              style={{ marginBottom: 8 }}
            >
              <Input
                size="large"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                prefix={
                  licenseStatus === 'valid' ? (
                    <CheckCircleFilled style={{ color: '#52c41a' }} />
                  ) : (
                    <KeyOutlined
                      style={{
                        color: licenseStatus === 'invalid' ? '#ff4d4f' : '#7a8796',
                      }}
                    />
                  )
                }
                style={{
                  ...fieldStyle,
                  borderColor: licenseBorder,
                  boxShadow: licenseGlow,
                  color:
                    licenseStatus === 'valid'
                      ? '#73d13d'
                      : licenseStatus === 'invalid'
                        ? '#ff7875'
                        : '#f0f4f8',
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
                style={{
                  height: 48,
                  fontWeight: 600,
                  fontSize: 15,
                  border: 'none',
                  borderRadius: 999,
                  background:
                    licenseStatus === 'valid'
                      ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                      : 'linear-gradient(135deg, #a99bf8 0%, #8b7cf6 55%, #6f5ee0 100%)',
                  boxShadow:
                    licenseStatus === 'valid'
                      ? '0 8px 24px rgba(82, 196, 26, 0.35)'
                      : '0 8px 24px rgba(22, 119, 255, 0.35)',
                }}
              >
                {licenseStatus === 'valid' ? 'License verified' : 'Continue'}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>

      <style>{`
        @keyframes tnLoginCardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tn-login-card .ant-input-affix-wrapper {
          background: rgba(8, 16, 28, 0.65) !important;
        }
        .tn-login-card .ant-input-affix-wrapper > input.ant-input {
          background: transparent !important;
          color: inherit !important;
        }
        .tn-login-card .ant-form-item-explain-error { color: #ff7875; }
        .tn-login-card .ant-form-item-explain-success { color: #73d13d; }
        @media (max-width: 880px) {
          .tn-login-shell {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            max-width: 440px !important;
          }
          .tn-login-brand { text-align: center; padding: 0 !important; }
          .tn-login-brand .tn-login-features { text-align: left; }
        }
      `}</style>
    </div>
  );
}

function getCampaignStatus(j) {
  const leads = j.total_leads || 0;
  if (j.status === 'queued' || (j.status === 'running' && leads === 0)) return { label: 'Pending', color: 'gold' };
  if (j.status === 'running') return { label: 'Processing', color: 'blue' };
  if (j.status === 'completed') return { label: 'Completed', color: 'green' };
  return { label: 'Failed', color: 'red' };
}

function getMaxResults(j) {
  return j.settings?.maxResultsPerSearch;
}

function LeadGeneratePage({ user }) {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignSort, setCampaignSort] = useState('created_desc');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [source, setSource] = useState('google_maps');
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [maxResults, setMaxResults] = useState(50);
  const [nearbyMe, setNearbyMe] = useState(false);
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [creating, setCreating] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewJobId, setViewJobId] = useState(null);
  const [viewJob, setViewJob] = useState(null);
  const [viewLeads, setViewLeads] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadKeys, setSelectedLeadKeys] = useState([]);

  const getBackendApi = () => {
    const base = getApiBase();
    const token = readLeadGenToken();
    return { base, token };
  };

  const refreshAccessToken = async () => {
    // ArcticSwitch tokens typically don't use /auth/refresh — skip soft-fail
    return null;
  };

  const authedFetch = async (path, init = {}, { retry = true } = {}) => {
    const { base, token } = getBackendApi();
    if (!base || !token) throw new Error('Not connected');
    const url = base.endsWith('/api') || base.includes('/api')
      ? `${base}${path.startsWith('/') ? path : `/${path}`}`
      : `${base}/api${path.startsWith('/') ? path : `/${path}`}`;
    const headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(url, { ...init, headers });
    if (res.status !== 401 || !retry) return res;
    const next = await refreshAccessToken();
    if (!next) return res;
    const headers2 = { ...(init.headers || {}), Authorization: `Bearer ${next}` };
    return await fetch(url, { ...init, headers: headers2 });
  };

  const refreshJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await fetch(LOCAL_API + '/jobs');
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setJobs(data);
        return;
      }
      // Fallback: keep existing jobs if local API briefly unavailable
      console.warn('[Lead Gen] Local jobs load failed:', data?.error || res.status);
    } catch (e) {
      console.warn('[Lead Gen] Local jobs load error:', e?.message || e);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => { refreshJobs(); }, []);

  const mapLeadRow = (l, i = 0) => ({
    key: String(l.id ?? l._id ?? i),
    name: l.business_name || l.name || '—',
    address: l.address || '—',
    phone: l.phone || '—',
    website: l.website || '',
    rating: l.rating,
    reviewsCount: l.reviews ?? l.reviewsCount,
    category: l.category || '—',
    mapsUrl: l.google_maps_url || l.url || l.mapsUrl || '',
  });

  const bumpJobLead = (jobId, lead) => {
    if (!jobId) return;
    setJobs((prev) =>
      prev.map((j) =>
        String(j.id) === String(jobId)
          ? { ...j, status: 'running', total_leads: (j.total_leads || 0) + 1 }
          : j
      )
    );
    setViewJob((v) => {
      if (!v || String(v.id) !== String(jobId)) return v;
      setViewLeads((prev) => [...prev, mapLeadRow(lead, prev.length)]);
      return { ...v, total_leads: (v.total_leads || 0) + 1, status: 'running' };
    });
  };

  // Socket: lazy-load to keep initial bundle smaller
  useEffect(() => {
    const { base, token } = getBackendApi();
    if (!base || !token) return;
    let socket;
    let cancelled = false;
    (async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;
        const origin = base.replace(/\/api\/?$/, '');
        socket = io(origin, {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        const onDeleted = (payload) => {
          const id = payload?.id != null ? String(payload.id) : null;
          if (!id) return;
          setJobs((prev) => prev.filter((j) => String(j.id || j._id) !== id));
          setViewJobId((current) => {
            if (current === id) {
              setViewOpen(false);
              return null;
            }
            return current;
          });
          message.info('Campaign deleted (removed from website)');
        };
        const onJobUpdated = (payload) => {
          const id = payload?.id != null ? String(payload.id) : null;
          if (!id) return;
          setJobs((prev) =>
            prev.map((j) => (String(j.id || j._id) === id ? { ...j, ...payload, id: id } : j))
          );
          if (viewJobId === id && payload.total_leads != null) {
            setViewJob((v) => (v && v.id === id ? { ...v, total_leads: payload.total_leads } : v));
          }
        };
        socket.on('scraper:job-deleted', onDeleted);
        socket.on('scraper:job-updated', onJobUpdated);
      } catch (_) {
        /* socket optional */
      }
    })();
    return () => {
      cancelled = true;
      try {
        socket?.disconnect();
      } catch (_) {}
    };
  }, []);

  const addOptimisticJob = (formData) => {
    const tempId = 'opt-' + Date.now();
    setJobs((prev) => [{
      id: tempId,
      name: (formData.name || formData.keyword || 'Campaign').trim(),
      keyword: formData.keyword || '—',
      location: formData.location || '',
      source: formData.source || 'google_maps',
      status: 'queued',
      total_leads: 0,
      startTime: new Date().toISOString(),
      settings: { maxResultsPerSearch: formData.maxResults || 50 },
      _optimistic: true,
    }, ...prev]);
    return tempId;
  };

  const removeOptimisticJob = (tempId) => {
    setJobs((prev) => prev.filter((j) => j.id !== tempId));
  };

  const createPendingJobOnBackend = async (name, source, keyword, location, maxResults) => {
    const { base, token } = getBackendApi();
    if (!base || !token) return null;
    const res = await authedFetch('/scraper-jobs/from-desktop-pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        source,
        keyword,
        location: location || undefined,
        maxResults: Math.min(200, Math.max(1, maxResults || 50)),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || data.message || res.statusText);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return data.jobId || null;
  };

  const pushLeadsBatch = async (jobId, leads) => {
    const { base, token } = getBackendApi();
    if (!base || !token || !leads.length) return;
    const res = await authedFetch(`/scraper-jobs/${jobId}/leads-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leads: leads.map((l) => ({
          business_name: l.name || l.business_name,
          address: l.address,
          phone: l.phone,
          website: l.website,
          rating: l.rating,
          reviews: l.reviews ?? l.reviewsCount,
          category: l.category,
          google_maps_url: l.google_maps_url || l.mapsUrl || l.url,
          email: l.email,
        })),
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Batch failed');
  };

  const completeDesktopJob = async (desktopJobId) => {
    const { base, token } = getBackendApi();
    if (!base || !token) return;
    const res = await authedFetch('/scraper-jobs/from-desktop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desktopJobId, completeOnly: true }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Complete failed');
  };

  const pushToBackend = async (name, source, keyword, location, maxResults, leads, desktopJobId = null) => {
    const { base, token } = getBackendApi();
    if (!base || !token) return;
    const body = {
      name, source, keyword, location: location || undefined,
      maxResults: Math.min(200, Math.max(1, maxResults || 50)),
      leads: leads.map((l) => ({
        business_name: l.name || l.business_name,
        address: l.address,
        phone: l.phone,
        website: l.website,
        rating: l.rating,
        reviews: l.reviews ?? l.reviewsCount,
        category: l.category,
        google_maps_url: l.google_maps_url || l.mapsUrl || l.url,
        email: l.email,
      })),
    };
    if (desktopJobId) body.desktopJobId = desktopJobId;
    const res = await authedFetch('/scraper-jobs/from-desktop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || data.message || res.statusText);
      err.status = res.status;
      throw err;
    }
  };

  const summary = useMemo(() => ({
    total: jobs.length,
    running: jobs.filter((j) => j.status === 'running' || j.status === 'queued').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    leads: jobs.reduce((acc, j) => acc + (j.total_leads || 0), 0),
  }), [jobs]);

  const rankStatus = (j) => {
    if (j.status === 'failed') return 3;
    if (j.status === 'completed') return 2;
    if (j.status === 'running' || j.status === 'queued') return 1;
    return 0;
  };

  const filteredSortedJobs = useMemo(() => {
    const filtered = !campaignSearch.trim()
      ? jobs
      : jobs.filter((j) =>
          `${j.name || ''} ${j.keyword || ''} ${j.location || ''}`.toLowerCase().includes(campaignSearch.toLowerCase())
        );
    return [...filtered].sort((a, b) => {
      const at = new Date(a.startTime || 0).getTime();
      const bt = new Date(b.startTime || 0).getTime();
      if (campaignSort === 'created_desc') return bt - at;
      if (campaignSort === 'created_asc') return at - bt;
      if (campaignSort === 'leads_desc') return (b.total_leads || 0) - (a.total_leads || 0);
      if (campaignSort === 'leads_asc') return (a.total_leads || 0) - (b.total_leads || 0);
      if (campaignSort === 'status') return rankStatus(b) - rankStatus(a);
      return bt - at;
    });
  }, [jobs, campaignSearch, campaignSort]);

  const openCreate = () => {
    setCampaignName('');
    setSource('google_maps');
    setKeyword('');
    setLocation(DEFAULT_LOCATION);
    setMaxResults(50);
    setNearbyMe(false);
    setCoords(null);
    setCreateOpen(true);
  };

  const requestLocation = async () => {
    if (!('geolocation' in navigator)) throw new Error('Geolocation not supported');
    const tryBrowserGeo = () =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(new Error(err?.message || 'Location permission denied')),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
        );
      });

    try {
      return await tryBrowserGeo();
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : String(e || '');
      // Electron/Chromium sometimes fails network provider (googleapis 403). Fallback to IP-based approx location.
      // We try this for any failure, but especially for googleapis/403 errors.
      const tryIpProviders = async () => {
        // 1) ipapi.co
        try {
          const r = await fetch('https://ipapi.co/json/');
          if (r.ok) {
            const d = await r.json().catch(() => null);
            const lat = d && (d.latitude ?? d.lat);
            const lon = d && (d.longitude ?? d.lon ?? d.lng);
            if (lat != null && lon != null) return { latitude: Number(lat), longitude: Number(lon) };
          }
        } catch (_) {}

        // 2) ipinfo.io (no token; loc="lat,lon")
        try {
          const r = await fetch('https://ipinfo.io/json');
          if (r.ok) {
            const d = await r.json().catch(() => null);
            const loc = d && d.loc;
            if (typeof loc === 'string' && loc.includes(',')) {
              const [lat, lon] = loc.split(',').map((x) => Number(x.trim()));
              if (Number.isFinite(lat) && Number.isFinite(lon)) return { latitude: lat, longitude: lon };
            }
          }
        } catch (_) {}

        // 3) ip-api.com
        try {
          const r = await fetch('http://ip-api.com/json/?fields=status,lat,lon,message');
          if (r.ok) {
            const d = await r.json().catch(() => null);
            if (d && d.status === 'success' && d.lat != null && d.lon != null) return { latitude: Number(d.lat), longitude: Number(d.lon) };
          }
        } catch (_) {}

        return null;
      };

      const ipLoc = await tryIpProviders();
      if (ipLoc && Number.isFinite(ipLoc.latitude) && Number.isFinite(ipLoc.longitude)) return ipLoc;

      // If IP fallback also fails, surface a clearer message (hide noisy googleapis 403).
      if (/googleapis|network location|error code 403|403/i.test(msg)) {
        throw new Error('Location service blocked (403). Please allow location, or connect internet/VPN and retry.');
      }
      throw e;
    }
  };

  const createCampaign = async () => {
    const name = (campaignName || '').trim();
    const kw = (keyword || '').trim();
    if (!name) { message.warning('Campaign name required'); return; }
    if (!kw) { message.warning('Keyword required'); return; }
    setCreating(true);
    const formData = { name, source, keyword: kw, location: location.trim(), maxResults };
    const tempId = addOptimisticJob(formData);
    setCreateOpen(false);
    const maxRes = Math.min(200, Math.max(10, maxResults));

    console.log('[Lead Gen] Create started:', { name, source, keyword: kw, location: location.trim(), maxResults: maxRes });

    let latLng = coords;
    if (source === 'google_maps' && nearbyMe && (!latLng || latLng.latitude == null || latLng.longitude == null)) {
      try {
        latLng = await requestLocation();
        setCoords(latLng);
      } catch (e) {
        message.error(e.message || 'Failed to get location');
        removeOptimisticJob(tempId);
        setCreating(false);
        return;
      }
    }

    let remoteJobId = null;
    const base = getApiBase();
    const token = readLeadGenToken();
    if (base && token) {
      try {
        remoteJobId = await createPendingJobOnBackend(name, source, kw, location.trim(), maxRes);
        if (remoteJobId) {
          console.log('[Lead Gen] Backend pending job created:', remoteJobId);
        }
      } catch (e) {
        console.warn('[Lead Gen] Backend pending job failed:', e.message);
        if (e.status === 401 || (e.message && /401|token|login|invalid|unauthorized/i.test(e.message))) {
          message.warning('Login expired. Local scrape will still save. Re-login to sync website.');
        }
      }
    }

    let localJobId = tempId;
    try {
      console.log('[Lead Gen] Calling local /generate-stream (live + local store)...');
      const res = await fetch(LOCAL_API + '/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          source,
          keyword: kw,
          location: source === 'google_maps' && nearbyMe ? '' : (location.trim() || undefined),
          maxResults: maxRes,
          latitude: source === 'google_maps' && nearbyMe ? latLng?.latitude : undefined,
          longitude: source === 'google_maps' && nearbyMe ? latLng?.longitude : undefined,
          remoteId: remoteJobId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Stream failed');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      let batch = [];
      const BATCH_SIZE = 3;
      let leadCount = 0;

      const flushBatch = async () => {
        if (!remoteJobId || !batch.length) {
          batch = [];
          return;
        }
        try {
          await pushLeadsBatch(remoteJobId, batch);
        } catch (e) {
          console.warn('[Lead Gen] Remote batch sync failed:', e.message);
        }
        batch = [];
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += done ? '' : dec.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let obj;
          try {
            obj = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (obj.type === 'meta' && obj.jobId) {
            localJobId = String(obj.jobId);
            setJobs((prev) =>
              prev.map((j) =>
                String(j.id) === String(tempId)
                  ? {
                      ...j,
                      id: localJobId,
                      status: 'running',
                      remoteId: remoteJobId || null,
                      _optimistic: false,
                    }
                  : j
              )
            );
            continue;
          }
          if (obj.done === true) {
            await flushBatch();
            setJobs((prev) =>
              prev.map((j) =>
                String(j.id) === String(localJobId)
                  ? {
                      ...j,
                      status: 'completed',
                      total_leads: typeof obj.total === 'number' ? obj.total : leadCount,
                      endTime: new Date().toISOString(),
                    }
                  : j
              )
            );
            continue;
          }
          if (obj.done === false && obj.error) {
            throw new Error(obj.error);
          }
          if (obj.error && !obj.name && !obj.business_name && obj.type !== 'lead') {
            throw new Error(obj.error);
          }
          // Lead line (type:lead or plain lead object)
          const lead = { ...obj };
          delete lead.type;
          leadCount += 1;
          bumpJobLead(localJobId, lead);
          batch.push(lead);
          if (batch.length >= BATCH_SIZE) await flushBatch();
        }
        if (done) break;
      }
      await flushBatch();

      if (remoteJobId) {
        try {
          await completeDesktopJob(remoteJobId);
          if (localJobId) {
            fetch(LOCAL_API + `/jobs/${localJobId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ remoteId: remoteJobId }),
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('[Lead Gen] Remote complete failed:', e.message);
        }
      }

      console.log('[Lead Gen] Stream finished, local leads:', leadCount);
      message.success(
        remoteJobId
          ? `Campaign saved locally (${leadCount} leads). Synced to website.`
          : `Campaign saved locally (${leadCount} leads).`
      );
      await refreshJobs();
    } catch (err) {
      console.error('[Lead Gen] Create failed:', err.message);
      setJobs((prev) =>
        prev.map((j) =>
          String(j.id) === String(localJobId) || String(j.id) === String(tempId)
            ? { ...j, status: 'failed', error: err.message }
            : j
        )
      );
      message.error(err.message);
      await refreshJobs();
    } finally {
      setCreating(false);
    }
  };

  const openView = (id) => {
    setViewJobId(id);
    setViewOpen(true);
  };

  useEffect(() => {
    if (!viewOpen || !viewJobId) return;
    setSelectedLeadKeys([]);
    setViewLoading(true);
    fetch(LOCAL_API + `/jobs/${viewJobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setViewJob(data);
        const results = data.results || [];
        setViewLeads(results.map((l, i) => mapLeadRow(l, i)));
      })
      .catch(() => setViewLeads([]))
      .finally(() => setViewLoading(false));
  }, [viewOpen, viewJobId]);

  const deleteCampaign = async (id) => {
    try {
      await fetch(LOCAL_API + `/jobs/${id}`, { method: 'DELETE' });
      const job = jobs.find((j) => String(j.id) === String(id));
      if (job?.remoteId) {
        try {
          await authedFetch(`/scraper-jobs/${job.remoteId}`, { method: 'DELETE' });
        } catch (_) {}
      }
      message.success('Campaign deleted');
      if (String(viewJobId) === String(id)) setViewOpen(false);
      refreshJobs();
    } catch (_) {
      message.error('Delete failed');
    }
  };

  const bulkDeleteSelected = async () => {
    const ids = selectedCampaignIds.filter((id) => {
      const j = jobs.find((x) => String(x.id) === String(id));
      return j && !j._optimistic;
    });
    if (ids.length === 0) return;
    for (const id of ids) {
      try {
        await fetch(LOCAL_API + `/jobs/${id}`, { method: 'DELETE' });
        const job = jobs.find((j) => String(j.id) === String(id));
        if (job?.remoteId) {
          try {
            await authedFetch(`/scraper-jobs/${job.remoteId}`, { method: 'DELETE' });
          } catch (_) {}
        }
      } catch (_) {}
    }
    message.success(`Deleted ${ids.length} campaign(s)`);
    setSelectedCampaignIds([]);
    refreshJobs();
  };

  const fetchJobLeads = async (jobId) => {
    const res = await fetch(LOCAL_API + `/jobs/${jobId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to load campaign');
    return Array.isArray(data.results) ? data.results : [];
  };

  const downloadSelectedCampaignLeadsCombined = async () => {
    const ids = selectedCampaignIds || [];
    if (!ids.length) return;
    message.loading({ content: 'Preparing download…', key: 'dl', duration: 0 });
    try {
      const all = [];
      for (const id of ids) {
        const job = jobs.find((j) => String(j.id) === String(id));
        const results = await fetchJobLeads(id);
        for (const l of results) {
          all.push({
            campaignId: id,
            campaign: (job?.name || job?.keyword || 'Campaign').trim(),
            source: job?.source || '',
            keyword: job?.keyword || '',
            location: job?.location || '',
            name: (l.business_name || l.name || '').trim(),
            address: (l.address || '').trim(),
            phone: (l.phone || '').trim(),
            website: (l.website || '').trim(),
            rating: typeof l.rating === 'number' ? l.rating : '',
            reviews: typeof (l.reviews ?? l.reviewsCount) === 'number' ? (l.reviews ?? l.reviewsCount) : '',
            category: (l.category || '').trim(),
            url: (l.google_maps_url || l.mapsUrl || l.url || '').trim(),
          });
        }
      }
      downloadCsv(`campaigns-selected-${new Date().toISOString().slice(0, 10)}.csv`, all);
      message.success({ content: 'Downloaded single file.', key: 'dl' });
    } catch (e) {
      message.error({ content: e.message || 'Download failed', key: 'dl' });
    }
  };

  const downloadSelectedCampaignLeadsSeparate = async () => {
    const ids = selectedCampaignIds || [];
    if (!ids.length) return;
    message.loading({ content: 'Preparing downloads…', key: 'dl', duration: 0 });
    try {
      for (const id of ids) {
        const job = jobs.find((j) => String(j.id) === String(id));
        const results = await fetchJobLeads(id);
        const rows = results.map((l) => ({
          campaignId: id,
          campaign: (job?.name || job?.keyword || 'Campaign').trim(),
          source: job?.source || '',
          keyword: job?.keyword || '',
          location: job?.location || '',
          name: (l.business_name || l.name || '').trim(),
          address: (l.address || '').trim(),
          phone: (l.phone || '').trim(),
          website: (l.website || '').trim(),
          rating: typeof l.rating === 'number' ? l.rating : '',
          reviews: typeof (l.reviews ?? l.reviewsCount) === 'number' ? (l.reviews ?? l.reviewsCount) : '',
          category: (l.category || '').trim(),
          url: (l.google_maps_url || l.mapsUrl || l.url || '').trim(),
        }));
        const base = (job?.name || job?.keyword || id || 'campaign').trim().replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
        downloadCsv(`${base || id}.csv`, rows);
        await new Promise((r) => setTimeout(r, 250));
      }
      message.success({ content: `Downloaded ${ids.length} file(s).`, key: 'dl' });
    } catch (e) {
      message.error({ content: e.message || 'Download failed', key: 'dl' });
    }
  };

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return viewLeads;
    const q = leadSearch.toLowerCase();
    return viewLeads.filter((l) =>
      `${l.name} ${l.phone} ${l.address} ${l.website}`.toLowerCase().includes(q)
    );
  }, [viewLeads, leadSearch]);

  const normalizeUrl = (url) => {
    const u = (url || '').trim();
    return !u ? '' : u.startsWith('http') ? u : 'https://' + u;
  };

  const campaignColumns = [
    {
      title: 'Campaign',
      dataIndex: 'name',
      key: 'name',
      render: (_, j) => (
        <div>
          <div style={{ fontWeight: 600 }}>{j.name || j.keyword || 'Campaign'}</div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>{j.keyword || '—'}{j.location ? ` · ${j.location}` : ''}</div>
          <Tag color={j.source === 'justdial' ? 'blue' : 'green'} style={{ marginTop: 4 }}>{j.source === 'justdial' ? 'JustDial' : 'Google Maps'}</Tag>
        </div>
      ),
    },
    { title: 'Status', key: 'status', width: 120, render: (_, j) => <Tag color={getCampaignStatus(j).color}>{getCampaignStatus(j).label}</Tag> },
    { title: 'Leads', key: 'leads', width: 80, render: (_, j) => j.total_leads || 0 },
    {
      title: 'Progress',
      key: 'progress',
      width: 200,
      render: (_, j) => {
        const max = getMaxResults(j);
        if (!max) return <Typography.Text type="secondary">—</Typography.Text>;
        const pct = Math.min(100, Math.floor(((j.total_leads || 0) / max) * 100));
        return <Progress percent={pct} size="small" status={j.status === 'failed' ? 'exception' : 'active'} />;
      },
    },
    { title: 'Created', key: 'created', width: 170, render: (_, j) => (j.startTime ? new Date(j.startTime).toLocaleString() : '—') },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, j) => {
        if (j._optimistic) return <Typography.Text type="secondary">Running…</Typography.Text>;
        return (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => openView(j.id)}>View</Button>
            <Popconfirm title="Delete this campaign?" onConfirm={() => deleteCampaign(j.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const leadsColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true, render: (t, r) => r.mapsUrl ? <a href={normalizeUrl(r.mapsUrl)} target="_blank" rel="noopener noreferrer">{t}</a> : t },
    { title: 'Address', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 140, ellipsis: true },
    { title: 'Website', dataIndex: 'website', key: 'website', ellipsis: true, render: (url) => url ? <a href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer">{url.length > 34 ? url.slice(0, 34) + '…' : url}</a> : '—' },
    { title: 'Rating', dataIndex: 'rating', key: 'rating', width: 90, render: (v) => (v != null ? `${v.toFixed(1)} ★` : '—') },
    { title: 'Reviews', dataIndex: 'reviewsCount', key: 'reviewsCount', width: 100, render: (v) => (v != null ? v.toLocaleString() : '—') },
    { title: 'Category', dataIndex: 'category', key: 'category', ellipsis: true, render: (v) => v || '—' },
  ];

  const deletableIds = useMemo(
    () => filteredSortedJobs.filter((j) => !j._optimistic && j.status !== 'running' && j.status !== 'queued').map((j) => j.id),
    [filteredSortedJobs]
  );

  return (
    <div className="lg-page" style={{ padding: '20px 22px 28px', maxWidth: 1280, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#fff',
              lineHeight: 1.15,
              marginBottom: 6,
            }}
          >
            Lead Generate
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
            {(user?.name || user?.phone || 'User').toString()}
            {user?.email ? ` · ${user.email}` : ''}
            {' — '}leads save locally and update live while scraping.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={openCreate}
          style={{
            height: 44,
            paddingInline: 20,
            fontWeight: 600,
            borderRadius: 12,
            boxShadow: '0 8px 22px rgba(139,124,246,0.28)',
          }}
        >
          Generate Leads
        </Button>
      </div>

      <Row gutter={[12, 12]}>
        {[
          { title: 'Campaigns', value: summary.total, accent: '#a99bf8' },
          { title: 'Running', value: summary.running, accent: '#faad14' },
          { title: 'Completed', value: summary.completed, accent: '#52c41a' },
          { title: 'Leads collected', value: summary.leads, accent: '#13c2c2' },
        ].map((s) => (
          <Col xs={12} md={6} key={s.title}>
            <Card className="lg-stat-card" bordered={false} styles={{ body: { padding: '16px 18px' } }}>
              <div style={{ fontSize: 12, color: '#9aa8b8', marginBottom: 6, fontWeight: 500 }}>{s.title}</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 99, background: `${s.accent}33` }}>
                <div style={{ width: '42%', height: '100%', borderRadius: 99, background: s.accent }} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{
          marginTop: 14,
          borderRadius: 16,
          border: `1px solid ${APP_BORDER}`,
          background: 'rgba(10, 21, 36, 0.72)',
        }}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input.Search
              placeholder="Search campaigns…"
              allowClear
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              style={{ width: 260 }}
            />
            <Select
              value={campaignSort}
              onChange={setCampaignSort}
              style={{ width: 180 }}
              options={[
                { value: 'created_desc', label: 'Newest first' },
                { value: 'created_asc', label: 'Oldest first' },
                { value: 'leads_desc', label: 'Most leads' },
                { value: 'leads_asc', label: 'Fewest leads' },
                { value: 'status', label: 'By status' },
              ]}
            />
          </Space>
          <Space wrap>
            <Popconfirm
              title="Delete selected campaigns?"
              onConfirm={bulkDeleteSelected}
              okText="Delete"
              okButtonProps={{ danger: true }}
              disabled={selectedCampaignIds.length === 0}
            >
              <Button danger icon={<DeleteOutlined />} disabled={selectedCampaignIds.length === 0}>
                Delete ({selectedCampaignIds.length})
              </Button>
            </Popconfirm>
            <Dropdown
              disabled={selectedCampaignIds.length === 0}
              menu={{
                items: [
                  {
                    key: 'combined',
                    label: 'Download one CSV',
                    icon: <DownloadOutlined />,
                    onClick: downloadSelectedCampaignLeadsCombined,
                  },
                  {
                    key: 'separate',
                    label: 'Download separate CSVs',
                    icon: <DownloadOutlined />,
                    onClick: downloadSelectedCampaignLeadsSeparate,
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button icon={<DownloadOutlined />} disabled={selectedCampaignIds.length === 0}>
                Export ({selectedCampaignIds.length})
              </Button>
            </Dropdown>
          </Space>
        </div>
        <Table
          rowKey="id"
          dataSource={filteredSortedJobs}
          loading={jobsLoading}
          columns={campaignColumns}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          rowSelection={{
            selectedRowKeys: selectedCampaignIds,
            onChange: (keys) => setSelectedCampaignIds(keys.filter((id) => deletableIds.includes(id))),
            getCheckboxProps: (record) => ({
              disabled: record._optimistic || record.status === 'running' || record.status === 'queued',
            }),
          }}
        />
      </Card>

      <Drawer
        title={
          <div>
            <div style={{ fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 18 }}>
              Generate Leads
            </div>
            <div style={{ fontSize: 12, color: '#9aa8b8', fontWeight: 400, marginTop: 2 }}>
              Fill details — scrape runs on this device
            </div>
          </div>
        }
        placement="right"
        width={440}
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        destroyOnClose
        maskClosable={!creating}
        styles={{
          body: { paddingTop: 12, display: 'flex', flexDirection: 'column' },
          header: { borderBottom: `1px solid ${APP_BORDER}` },
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Campaign name</Typography.Text>
            <Input
              size="large"
              placeholder="e.g. Ahmedabad plumbers"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              style={{ marginTop: 8, borderRadius: 10 }}
            />
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Source</Typography.Text>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <div
                className={`lg-source-card${source === 'google_maps' ? ' is-active' : ''}`}
                onClick={() => setSource('google_maps')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSource('google_maps')}
              >
                <GlobalOutlined style={{ color: PRIMARY, fontSize: 18, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>Google Maps</div>
                <div style={{ fontSize: 12, color: '#9aa8b8', marginTop: 4, lineHeight: 1.35 }}>
                  Businesses by area or nearby
                </div>
              </div>
              <div
                className={`lg-source-card${source === 'justdial' ? ' is-active' : ''}`}
                onClick={() => setSource('justdial')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSource('justdial')}
              >
                <EnvironmentOutlined style={{ color: '#faad14', fontSize: 18, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>JustDial</div>
                <div style={{ fontSize: 12, color: '#9aa8b8', marginTop: 4, lineHeight: 1.35 }}>
                  City + keyword listings
                </div>
              </div>
            </div>
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Keyword</Typography.Text>
            <Input
              size="large"
              placeholder="e.g. plumbers, loan agents"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ marginTop: 8, borderRadius: 10 }}
              prefix={<SearchOutlined style={{ color: '#7a8796' }} />}
            />
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              {source === 'justdial' ? 'City' : 'Location'}
            </Typography.Text>
            {source === 'google_maps' && (
              <div style={{ marginTop: 10 }}>
                <Checkbox
                  checked={nearbyMe}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setNearbyMe(next);
                    if (next) {
                      try {
                        const c = await requestLocation();
                        setCoords(c);
                        message.success('Using your current location');
                      } catch (err) {
                        setNearbyMe(false);
                        setCoords(null);
                        message.error(err.message || 'Location permission denied');
                      }
                    } else {
                      setCoords(null);
                    }
                  }}
                >
                  Nearby me
                </Checkbox>
                {nearbyMe && coords && (
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                    GPS {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </Typography.Text>
                )}
              </div>
            )}
            <Input
              size="large"
              disabled={source === 'google_maps' && nearbyMe}
              placeholder={source === 'justdial' ? 'e.g. Ahmedabad, Mumbai' : DEFAULT_LOCATION}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ marginTop: 8, borderRadius: 10 }}
              prefix={<EnvironmentOutlined style={{ color: '#7a8796' }} />}
            />
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Max results</Typography.Text>
            <InputNumber
              min={10}
              max={200}
              size="large"
              value={maxResults}
              onChange={(v) => typeof v === 'number' && setMaxResults(v)}
              style={{ marginTop: 8, width: '100%', borderRadius: 10 }}
            />
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
              Between 10 and 200 leads per campaign
            </Typography.Text>
          </div>
        </div>

        <div className="lg-drawer-footer">
          <Button size="large" disabled={creating} onClick={() => setCreateOpen(false)} style={{ borderRadius: 10 }}>
            Cancel
          </Button>
          <Button
            type="primary"
            size="large"
            loading={creating}
            onClick={createCampaign}
            disabled={!campaignName.trim() || !keyword.trim()}
            icon={<PlusOutlined />}
            style={{ borderRadius: 10, fontWeight: 600, minWidth: 140 }}
          >
            Start scrape
          </Button>
        </div>
      </Drawer>

      <Drawer
        title={viewJob?.name || viewJob?.keyword || 'Campaign'}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        width={Math.min(920, typeof window !== 'undefined' ? window.innerWidth - 40 : 900)}
        destroyOnClose
        styles={{ header: { borderBottom: `1px solid ${APP_BORDER}` } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small" styles={{ body: { padding: 14 } }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <div>
                  <Typography.Text type="secondary">Status</Typography.Text>
                  <div style={{ marginTop: 4 }}>
                    {viewJob ? (
                      <Tag color={getCampaignStatus(viewJob).color}>{getCampaignStatus(viewJob).label}</Tag>
                    ) : (
                      <Tag>—</Tag>
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Statistic title="Leads" value={viewJob?.total_leads ?? viewLeads.length} />
              </Col>
              <Col xs={24} md={8}>
                {viewJob && getMaxResults(viewJob) ? (
                  <div>
                    <Typography.Text type="secondary">Progress</Typography.Text>
                    <Progress
                      percent={Math.min(
                        100,
                        Math.floor(((viewJob.total_leads || 0) / getMaxResults(viewJob)) * 100)
                      )}
                      status={viewJob.status === 'failed' ? 'exception' : 'active'}
                      style={{ marginTop: 6 }}
                    />
                  </div>
                ) : (
                  <Typography.Text type="secondary">Progress: —</Typography.Text>
                )}
              </Col>
            </Row>
          </Card>
          <Card
            size="small"
            title="Leads"
            extra={
              <Space wrap>
                <Input.Search
                  placeholder="Search leads…"
                  allowClear
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  style={{ width: 200 }}
                />
                <Typography.Text type="secondary">{filteredLeads.length}</Typography.Text>
                <Button
                  icon={<DownloadOutlined />}
                  disabled={selectedLeadKeys.length === 0}
                  onClick={() => {
                    const selected = filteredLeads.filter((l) => selectedLeadKeys.includes(l.key));
                    const rows = selected.map((l) => ({
                      name: l.name,
                      address: l.address,
                      phone: l.phone,
                      website: l.website,
                      rating: l.rating ?? '',
                      reviews: l.reviewsCount ?? '',
                      category: l.category ?? '',
                      url: l.mapsUrl ?? '',
                    }));
                    const fname = `${(viewJob?.name || viewJob?.keyword || 'leads').replace(/\s+/g, '-')}-selected.csv`;
                    downloadCsv(fname, rows);
                  }}
                >
                  Export
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={filteredLeads}
              columns={leadsColumns}
              loading={viewLoading}
              rowKey="key"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              rowSelection={{
                selectedRowKeys: selectedLeadKeys,
                onChange: (keys) => setSelectedLeadKeys(keys),
              }}
            />
          </Card>
        </Space>
      </Drawer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = readLeadGenToken();
      const cached = readLeadGenUser();

      // Stay logged in: show cached Lead Gen session immediately
      if (token && cached) {
        try {
          assertLeadGenUser(cached);
          if (!cancelled) {
            setUser(cached);
            setAuthReady(true);
          }
        } catch {
          clearLeadGenAuth();
          if (!cancelled) {
            setUser(null);
            setAuthReady(true);
          }
          return;
        }
      } else if (!token) {
        clearLeadGenAuth();
        if (!cancelled) {
          setUser(null);
          setAuthReady(true);
        }
        return;
      } else {
        if (!cancelled) setAuthReady(true);
      }

      if (!token) return;

      try {
        const res = await fetch(`${TEXTNEXUS_API}/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        const msg = String(data?.message || '').toLowerCase();

        // Only force re-login when account is gone — not on network / soft errors
        if (res.status === 404 || msg.includes('user not found')) {
          clearLeadGenAuth();
          if (!cancelled) setUser(null);
          return;
        }

        if (!res.ok || !data?.user) {
          return; // keep cached session
        }

        try {
          assertLeadGenUser(data.user);
          const next = { ...data.user, type: data.user.type || LEAD_GEN_APP_TYPE };
          saveLeadGenAuth({
            accessToken: token,
            refreshToken: localStorage.getItem(LG_REFRESH_KEY) || localStorage.getItem('refreshToken'),
            user: next,
            backendUrl: TEXTNEXUS_API,
          });
          if (!cancelled) setUser(next);
        } catch (typeErr) {
          clearLeadGenAuth();
          message.error(typeErr.message || 'Use a Lead Gen license key');
          if (!cancelled) setUser(null);
        }
      } catch {
        // Offline / API down — keep cached Lead Gen session
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = (data) => setUser(data.user);

  if (!authReady) {
    return (
      <ConfigProvider theme={darkTheme}>
        <div
          style={{
            minHeight: '100vh',
            background: APP_BG_GRADIENT,
            color: '#eef3f8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT_FAMILY,
          }}
        >
          Loading…
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={darkTheme}>
      <div style={{ minHeight: '100vh', background: APP_BG_GRADIENT, color: '#eef3f8' }}>
        {!user ? <KeyLogin onLogin={handleLogin} /> : <LeadGeneratePage user={user} />}
      </div>
    </ConfigProvider>
  );
}
