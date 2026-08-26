import React, { useEffect, useMemo, useState } from 'react';
import {
  Layout,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Drawer,
  Form,
  Select,
  Upload,
  Empty,
  Flex,
  theme,
  message,
  Modal,
  Dropdown,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  AppstoreOutlined,
  UploadOutlined,
  GlobalOutlined,
  DeleteOutlined,
  MailOutlined,
  RedditOutlined,
  SpotifyOutlined,
  RobotOutlined,
  VideoCameraOutlined,
  FireOutlined,
  TeamOutlined,
  ThunderboltFilled,
  CloudServerOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import vegamoviesIcon from '../assets/movies/vegamovies.png';
import movies4uIcon from '../assets/movies/movies4u.png';
import hdhub4uIcon from '../assets/movies/hdhub4u.png';
import katmoviehdIcon from '../assets/movies/katmoviehd.png';
import ubuntuLogo from '../assets/brands/ubuntu.svg';
import serverLogo from '../assets/brands/server.svg';
import bulkWhatsAppLogo from '../assets/brands/bulk-whatsapp.png';
import snapchatLogo from '../assets/brands/snapchat.svg';
import leadGenLogo from '../assets/brands/lead-gen.png';
import {
  loadCustomCatalog,
  loadCustomCategories,
  saveCustomCatalog,
  saveCustomCategories,
} from '../utils/customCatalog';
import { fileToDataUrl } from '../utils/imageFile';
import { getServiceConfig, getFaviconFromUrl } from '../utils/serviceConfig';
import { APP_TOP_BAR_HEIGHT, COLORS } from '../constants';
import type { AddServiceOptions, CatalogService, ServiceCategoryDef, SshHostConfig } from '../types';
import { ServiceLogo } from '../components/common';
import HostDetailsModal from '../components/HostDetailsModal';
import { useAuth } from '../context/AuthContext';
import { isProPlan, isProServiceId } from '../utils/planAccess';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface AvailableServicesProps {
  isDarkMode?: boolean;
  onSelectService: (type: string, customName?: string, options?: AddServiceOptions) => void;
}

type DisplayService = CatalogService & { iconNode: React.ReactNode };

const BUILTIN_CATEGORIES: ServiceCategoryDef[] = [
  { key: 'popular', label: 'Most popular' },
  { key: 'all', label: 'All services' },
  { key: 'ai', label: 'AI Services' },
  { key: 'social', label: 'Social Media' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'business', label: 'Business' },
  { key: 'movies', label: 'Movies' },
  { key: 'server', label: 'Server Add' },
  { key: 'tools', label: 'Pro Plan' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  popular: <FireOutlined />,
  all: <AppstoreOutlined />,
  ai: <RobotOutlined />,
  social: <TeamOutlined />,
  productivity: <ThunderboltFilled />,
  entertainment: <SpotifyOutlined />,
  business: <MailOutlined />,
  movies: <VideoCameraOutlined />,
  server: <CloudServerOutlined />,
  tools: <CrownOutlined />,
};

function img(src: string, alt: string, size = 40) {
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}

const BUILTIN_SERVICES: DisplayService[] = (
  [
    { id: 'whatsapp', name: 'WhatsApp', description: 'Messaging app', category: 'popular' },
    { id: 'gmail', name: 'Gmail', description: 'Email service', category: 'popular' },
    { id: 'telegram', name: 'Telegram', description: 'Secure messaging', category: 'popular' },
    { id: 'discord', name: 'Discord', description: 'Voice & text chat', category: 'popular' },
    { id: 'facebook', name: 'Facebook', description: 'Social network', category: 'social' },
    { id: 'instagram', name: 'Instagram', description: 'Photo sharing', category: 'social' },
    {
      id: 'snapchat',
      name: 'Snapchat',
      description: 'Snapchat Web chat inside ArcticSwitch',
      category: 'social',
      iconSrc: snapchatLogo,
    },
    { id: 'twitter', name: 'Twitter / X', description: 'Social media', category: 'social' },
    { id: 'linkedin', name: 'LinkedIn', description: 'Professional network', category: 'social' },
    { id: 'reddit', name: 'Reddit', description: 'Discussion platform', category: 'social' },
    { id: 'github', name: 'GitHub', description: 'Code repository', category: 'productivity' },
    { id: 'google-calendar', name: 'Google Calendar', description: 'Schedule and events', category: 'productivity' },
    { id: 'google-meet', name: 'Google Meet', description: 'Video meetings', category: 'productivity' },
    { id: 'google-drive', name: 'Google Drive', description: 'Cloud storage', category: 'productivity' },
    { id: 'google-docs', name: 'Google Docs', description: 'Documents and writing', category: 'productivity' },
    { id: 'google-sheets', name: 'Google Sheets', description: 'Spreadsheets', category: 'productivity' },
    { id: 'google-slides', name: 'Google Slides', description: 'Presentations', category: 'productivity' },
    { id: 'excel', name: 'Excel Online', description: 'Microsoft Excel in the browser', category: 'productivity' },
    { id: 'word', name: 'Word Online', description: 'Microsoft Word in the browser', category: 'productivity' },
    { id: 'teams', name: 'Microsoft Teams', description: 'Team chat and meetings', category: 'business' },
    { id: 'spotify', name: 'Spotify', description: 'Music streaming', category: 'entertainment' },
    { id: 'godaddy-email', name: 'GoDaddy Web Email', description: 'Business email hosting', category: 'business' },
    { id: 'chatgpt', name: 'ChatGPT', description: 'AI assistant by OpenAI', category: 'ai' },
    { id: 'gemini', name: 'Gemini', description: 'AI assistant by Google', category: 'ai' },
    { id: 'grok', name: 'Grok', description: 'AI assistant by xAI', category: 'ai' },
    {
      id: 'vegamovies',
      name: 'VegaMovies',
      description: 'Movies & series',
      category: 'movies',
      iconSrc: vegamoviesIcon,
    },
    {
      id: 'movies4u',
      name: 'Movies4u',
      description: 'Bollywood & Hollywood',
      category: 'movies',
      iconSrc: movies4uIcon,
    },
    {
      id: 'hdhub4u',
      name: 'HDHub4u',
      description: 'HD movies hub',
      category: 'movies',
      iconSrc: hdhub4uIcon,
    },
    {
      id: 'katmoviehd',
      name: 'KatMovieHD',
      description: 'Movie downloads',
      category: 'movies',
      iconSrc: katmoviehdIcon,
    },
    {
      id: 'ubuntu',
      name: 'Ubuntu',
      description: 'SSH terminal — connect any Ubuntu server',
      category: 'server',
      iconSrc: ubuntuLogo,
    },
    {
      id: 'ssh-server',
      name: 'SSH Server',
      description: 'Connect any Linux / VPS server over SSH',
      category: 'server',
      iconSrc: serverLogo,
    },
    {
      id: 'bulk-whatsapp',
      name: 'Bulk WhatsApp',
      description: 'Campaigns & mass messaging — Pro plan',
      category: 'tools',
      iconSrc: bulkWhatsAppLogo,
    },
    {
      id: 'lead-gen',
      name: 'Lead Gen',
      description: 'Generate leads from JustDial & Google Maps — Pro plan',
      category: 'tools',
      iconSrc: leadGenLogo,
    },
  ] as const
).map((s) => {
  const cfg = getServiceConfig(s.id);
  const iconSrc = ('iconSrc' in s && s.iconSrc) || cfg.logoSrc || getFaviconFromUrl(cfg.url) || undefined;
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    color: cfg.color,
    url: cfg.url,
    builtIn: true,
    iconSrc,
    iconNode: iconSrc ? (
      img(iconSrc, s.name)
    ) : (
      <ServiceLogo iconType={s.id} url={cfg.url} size={40} />
    ),
  };
});

/** Kept in code / configs — hidden from Available Services catalog UI only. */
const HIDDEN_FROM_CATALOG = new Set([
  'vegamovies',
  'movies4u',
  'hdhub4u',
  'katmoviehd',
  'bulk-whatsapp',
  'lead-gen',
]);

export default function AvailableServices({
  isDarkMode = false,
  onSelectService,
}: AvailableServicesProps) {
  const { userProfile } = useAuth();
  const proUser = isProPlan(userProfile);
  const { token } = theme.useToken();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('popular');
  const [customCategories, setCustomCategories] = useState<ServiceCategoryDef[]>([]);
  const [customCatalog, setCustomCatalog] = useState<CatalogService[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [selected, setSelected] = useState<DisplayService | null>(null);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState<string | undefined>();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState<string | undefined>();
  const [addForm] = Form.useForm();

  const showProRequired = (serviceName: string) => {
    Modal.info({
      title: 'Pro plan required',
      content: `${serviceName} is included in the Pro plan (along with Bulk WhatsApp & Lead Gen). Upgrade your license to unlock it.`,
      okText: 'Got it',
    });
  };

  useEffect(() => {
    void (async () => {
      const [cats, catalog] = await Promise.all([
        loadCustomCategories(),
        loadCustomCatalog(),
      ]);
      setCustomCategories(cats);
      setCustomCatalog(catalog);
    })();
  }, []);

  const allServices = useMemo(() => {
    const customDisplay: DisplayService[] = customCatalog.map((s) => ({
      ...s,
      builtIn: false,
      iconNode: s.iconSrc ? img(s.iconSrc, s.name) : <GlobalOutlined style={{ color: s.color }} />,
    }));
    const visibleBuiltIn = BUILTIN_SERVICES.filter((s) => !HIDDEN_FROM_CATALOG.has(s.id));
    return [...visibleBuiltIn, ...customDisplay];
  }, [customCatalog]);

  const categories = useMemo(() => {
    const base = [...BUILTIN_CATEGORIES];
    for (const c of customCategories) {
      if (!base.some((b) => b.key === c.key)) base.push(c);
    }
    return base
      .map((c) => ({
        ...c,
        count:
          c.key === 'all'
            ? allServices.length
            : allServices.filter((s) => s.category === c.key).length,
      }))
      // Hide empty built-in groups (e.g. Movies / Pro Plan when their services are hidden)
      .filter((c) => c.key === 'all' || c.key === 'popular' || c.count > 0);
  }, [customCategories, allServices]);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.key !== 'all' && c.key !== 'popular')
        .map((c) => ({ value: c.key, label: c.label })),
    [categories]
  );

  const filtered = useMemo(() => {
    let list =
      activeCategory === 'all'
        ? allServices
        : allServices.filter((s) => s.category === activeCategory);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allServices, activeCategory, searchTerm]);

  const openCustomize = (service: DisplayService) => {
    setSelected(service);
    if (isProServiceId(service.id) && !proUser) {
      showProRequired(service.name);
      setSelected(null);
      return;
    }
    if (service.id === 'ubuntu' || service.id === 'ssh-server') {
      setHostOpen(true);
      return;
    }
    if (service.id === 'bulk-whatsapp') {
      onSelectService(service.id, service.name, { kind: 'bulk-wa' });
      message.success(`${service.name} opened inside ArcticSwitch`);
      setSelected(null);
      return;
    }
    if (service.id === 'lead-gen') {
      onSelectService(service.id, service.name, { kind: 'lead-gen' });
      message.success(`${service.name} opened inside ArcticSwitch`);
      setSelected(null);
      return;
    }
    setCustomName(`${service.name} Account`);
    setCustomIcon(undefined);
    setCustomizeOpen(true);
  };

  const confirmHostConnect = (label: string, ssh: SshHostConfig, customIcon?: string) => {
    if (!selected) return;
    const options: AddServiceOptions = {
      kind: 'ssh',
      ssh,
      ...(customIcon ? { customIcon } : {}),
    };
    onSelectService(selected.id, label, options);
    setHostOpen(false);
    setSelected(null);
    message.success(`${label} added — connecting…`);
  };

  const confirmAdd = () => {
    if (!selected || !customName.trim()) return;
    const options: AddServiceOptions = {};
    if (customIcon) options.customIcon = customIcon;
    if (selected.url) options.url = selected.url;
    onSelectService(selected.id, customName.trim(), options);
    setCustomizeOpen(false);
    message.success(`${customName.trim()} added`);
  };

  const handleCreateCategory = async () => {
    const label = categoryName.trim();
    if (!label) {
      message.warning('Enter a category name');
      return;
    }
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!key) {
      message.warning('Invalid category name');
      return;
    }
    if (categories.some((c) => c.key === key)) {
      message.warning('Category already exists');
      return;
    }
    const entry: ServiceCategoryDef = {
      key,
      label,
      ...(categoryIcon ? { iconSrc: categoryIcon } : {}),
    };
    const next = [...customCategories, entry];
    setCustomCategories(next);
    await saveCustomCategories(next);
    setCategoryName('');
    setCategoryIcon(undefined);
    setCategoryOpen(false);
    setActiveCategory(key);
    message.success(`Category "${label}" created`);
  };

  const isCustomCategory = (key: string) =>
    customCategories.some((c) => c.key === key);

  const handleRemoveCategory = (key: string, label: string) => {
    if (!isCustomCategory(key)) {
      message.info('Built-in categories cannot be removed');
      return;
    }
    Modal.confirm({
      title: 'Remove category?',
      content: `"${label}" will be removed. Services in this category stay in All services.`,
      okText: 'Remove',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const next = customCategories.filter((c) => c.key !== key);
        setCustomCategories(next);
        await saveCustomCategories(next);
        if (activeCategory === key) setActiveCategory('popular');
        message.success(`${label} removed`);
      },
    });
  };

  const renderCategoryIcon = (c: { key: string; iconSrc?: string }, active: boolean) => {
    if (c.iconSrc) {
      return (
        <img
          src={c.iconSrc}
          alt=""
          style={{
            width: 20,
            height: 20,
            objectFit: 'contain',
            display: 'block',
            borderRadius: 4,
          }}
        />
      );
    }
    return (
      <span style={{ color: active ? COLORS.PRIMARY : token.colorTextSecondary, fontSize: 17 }}>
        {CATEGORY_ICONS[c.key] || <AppstoreOutlined />}
      </span>
    );
  };

  const handleAddCustom = async () => {
    try {
      const values = await addForm.validateFields();
      const fileList = values.iconFile?.fileList as { originFileObj?: File }[] | undefined;
      const file = fileList?.[0]?.originFileObj;
      if (!file) {
        message.error('Please upload an icon image');
        return;
      }
      const iconSrc = await fileToDataUrl(file);
      let url = String(values.url || '').trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

      const id = `custom-${Date.now()}`;
      const entry: CatalogService = {
        id,
        name: values.name.trim(),
        description: values.description?.trim() || 'Custom website',
        category: values.category,
        url,
        color: '#ffffff',
        iconSrc,
        builtIn: false,
      };
      const nextCatalog = [...customCatalog, entry];
      setCustomCatalog(nextCatalog);
      await saveCustomCatalog(nextCatalog);
      onSelectService(id, values.name.trim(), { url, customIcon: iconSrc });
      setAddOpen(false);
      addForm.resetFields();
      message.success('Custom service added');
    } catch {
      /* validation */
    }
  };

  const handleRemoveCustom = (service: DisplayService, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Remove custom service?',
      content: `"${service.name}" will be removed from Available services.`,
      okText: 'Remove',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const next = customCatalog.filter((s) => s.id !== service.id);
        setCustomCatalog(next);
        await saveCustomCatalog(next);
        message.success(`${service.name} removed`);
      },
    });
  };

  const bg = isDarkMode ? '#000000' : '#f5f5f5';
  const panel = isDarkMode ? '#000000' : '#fff';
  const border = isDarkMode ? COLORS.APP_BORDER : '#f0f0f0';

  return (
    <div
      className={`tn-available-services${isDarkMode ? ' is-dark' : ''}`}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: bg,
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          height: APP_TOP_BAR_HEIGHT,
          boxSizing: 'border-box',
          padding: '0 20px',
          borderBottom: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
          background: isDarkMode ? '#000000' : '#fafafa',
        }}
      >
        <Space>
          <AppstoreOutlined style={{ fontSize: 16 }} />
          <Text strong style={{ fontSize: 16 }}>
            Available services
          </Text>
        </Space>
        <Space>
          <Input
            allowClear
            placeholder="Search service"
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 260, borderRadius: 999 }}
          />
          <Button
            type="primary"
            className="tn-add-pill"
            icon={<PlusOutlined />}
            onClick={() => setAddOpen(true)}
            style={{
              borderRadius: 999,
              background: '#ffffff',
              color: '#111111',
              border: 'none',
              fontWeight: 600,
              boxShadow: 'none',
            }}
          >
            Add
          </Button>
        </Space>
      </div>

      <Layout
        style={{
          flex: 1,
          background: bg,
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Sider
          width={236}
          theme={isDarkMode ? 'dark' : 'light'}
          style={{
            background: panel,
            borderRight: `1px solid ${border}`,
            overflow: 'auto',
            height: '100%',
          }}
        >
          <div
            style={{
              padding: '20px 16px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text
              type="secondary"
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
              }}
            >
              Categories
            </Text>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: 13 }} />}
              onClick={() => setCategoryOpen(true)}
              title="Add category"
              style={{
                width: 28,
                height: 28,
                minWidth: 28,
                padding: 0,
                borderRadius: 8,
                color: isDarkMode ? 'rgba(255,255,255,0.72)' : '#595959',
              }}
            />
          </div>
          <div
            style={{
              padding: '4px 12px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {categories.map((c) => {
              const active = activeCategory === c.key;
              const custom = isCustomCategory(c.key);
              const row = (
                <button
                  type="button"
                  onClick={() => setActiveCategory(c.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    margin: 0,
                    padding: '12px 14px',
                    border: active
                      ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.16)'}`
                      : '1px solid transparent',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: active
                      ? isDarkMode
                        ? 'rgba(255,255,255,0.16)'
                        : COLORS.PRIMARY_SOFT
                      : 'transparent',
                    color: active ? COLORS.PRIMARY : token.colorText,
                    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = isDarkMode
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = active
                      ? isDarkMode
                        ? 'rgba(255,255,255,0.16)'
                        : COLORS.PRIMARY_SOFT
                      : 'transparent';
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {renderCategoryIcon(c, active)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.label}
                  </span>
                  <span
                    style={{
                      minWidth: 24,
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      lineHeight: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      background: active
                        ? COLORS.PRIMARY
                        : isDarkMode
                          ? 'rgba(255, 255, 255, 0.1)'
                          : '#ececec',
                      color: active
                        ? '#111111'
                        : isDarkMode
                          ? 'rgba(255, 255, 255, 0.78)'
                          : '#595959',
                    }}
                  >
                    {c.count}
                  </span>
                </button>
              );

              if (!custom) return <React.Fragment key={c.key}>{row}</React.Fragment>;

              return (
                <Dropdown
                  key={c.key}
                  trigger={['contextMenu']}
                  menu={{
                    items: [
                      {
                        key: 'remove',
                        label: 'Remove',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => handleRemoveCategory(c.key, c.label),
                      },
                    ],
                  }}
                >
                  {row}
                </Dropdown>
              );
            })}
          </div>
        </Sider>

        <Content
          className="tn-available-services-content"
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            minHeight: 0,
            height: '100%',
          }}
        >
          <div>
            <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <div>
                <Title level={4} style={{ margin: 0, color: token.colorText }}>
                  {categories.find((c) => c.key === activeCategory)?.label || 'Services'}
                </Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                  Click a service to add it to your workspace. Customize name and icon before adding.
                </Paragraph>
              </div>
              <Button type="link" onClick={() => setAddOpen(true)}>
                Missing a service? →
              </Button>
            </Flex>

            {filtered.length === 0 ? (
              <Empty
                description="No services found"
                style={{ marginTop: 64 }}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                  Add custom website
                </Button>
              </Empty>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 12,
                }}
              >
                {filtered.map((service) => (
                  <Card
                    key={service.id}
                    hoverable
                    onClick={() => openCustomize(service)}
                    styles={{
                      body: {
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 10,
                        minHeight: 150,
                        position: 'relative',
                      },
                    }}
                    style={{
                      borderRadius: 12,
                      borderColor: border,
                      background: panel,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${service.color}33`;
                      e.currentTarget.style.borderColor = service.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = border;
                    }}
                  >
                    {!service.builtIn && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        aria-label={`Remove ${service.name}`}
                        onClick={(e) => handleRemoveCustom(service, e)}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          zIndex: 2,
                          width: 28,
                          height: 28,
                          minWidth: 28,
                          padding: 0,
                          background: isDarkMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.9)',
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: isDarkMode ? '#1f1f1f' : `${service.color}14`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 28,
                        color: service.color,
                      }}
                    >
                      {service.iconSrc ? img(service.iconSrc, service.name, 32) : service.iconNode}
                    </div>
                    <div>
                      <Text strong style={{ display: 'block', fontSize: 14 }}>
                        {service.name}
                        {isProServiceId(service.id) ? (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: 0.4,
                              textTransform: 'uppercase',
                              color: proUser ? '#bfbfbf' : '#8c8c8c',
                              background: proUser
                                ? 'rgba(255,255,255,0.16)'
                                : 'rgba(140,140,140,0.15)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            Pro
                          </span>
                        ) : null}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {service.description}
                      </Text>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Content>
      </Layout>

      {/* Customize built-in / catalog service */}
      <Drawer
        title={selected ? `Add ${selected.name}` : 'Add service'}
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        width={400}
        destroyOnClose
        styles={{ body: { paddingTop: 12 } }}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setCustomizeOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              disabled={!customName.trim()}
              onClick={confirmAdd}
              style={
                selected
                  ? { background: selected.color, borderColor: selected.color }
                  : undefined
              }
            >
              Add to workspace
            </Button>
          </Flex>
        }
      >
        {selected && (
          <>
            <Flex align="center" gap={16} style={{ marginBottom: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: isDarkMode ? '#1f1f1f' : `${selected.color}14`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  color: selected.color,
                  overflow: 'hidden',
                }}
              >
                {customIcon ? (
                  img(customIcon, 'icon', 40)
                ) : selected.iconSrc ? (
                  img(selected.iconSrc, selected.name, 40)
                ) : (
                  selected.iconNode
                )}
              </div>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  void fileToDataUrl(file).then((data) => {
                    setCustomIcon(data);
                    message.success('Icon updated');
                  });
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>Change icon</Button>
              </Upload>
            </Flex>
            <Form layout="vertical">
              <Form.Item label="Service name" required>
                <Input
                  size="large"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter a name"
                  maxLength={50}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Opens: {selected.url}
              </Text>
            </Form>
          </>
        )}
      </Drawer>

      {/* Add custom website */}
      <Drawer
        title="Add custom website"
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          addForm.resetFields();
        }}
        width={420}
        destroyOnClose
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button
              onClick={() => {
                setAddOpen(false);
                addForm.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="tn-add-pill"
              icon={<PlusOutlined />}
              onClick={() => void handleAddCustom()}
              style={{
                borderRadius: 999,
                background: '#ffffff',
                color: '#111111',
                border: 'none',
                fontWeight: 600,
                boxShadow: 'none',
              }}
            >
              Add Service
            </Button>
          </Flex>
        }
      >
        <Paragraph type="secondary">
          Add any website with your own icon and category.
        </Paragraph>
        <Form form={addForm} layout="vertical" initialValues={{ category: 'movies' }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Enter a name' }]}
          >
            <Input placeholder="My Website" prefix={<AppstoreOutlined />} />
          </Form.Item>
          <Form.Item
            name="url"
            label="Website URL"
            rules={[{ required: true, message: 'Enter a URL' }]}
          >
            <Input placeholder="https://example.com" prefix={<GlobalOutlined />} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="Short description" />
          </Form.Item>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Select a category' }]}
          >
            <Select options={categoryOptions} />
          </Form.Item>

          <Form.Item
            name="iconFile"
            label="Icon image"
            rules={[{ required: true, message: 'Upload an icon' }]}
            valuePropName="file"
          >
            <Upload accept="image/*" maxCount={1} beforeUpload={() => false} listType="picture-card">
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>Upload</div>
              </div>
            </Upload>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Add category */}
      <Drawer
        title="Add category"
        open={categoryOpen}
        onClose={() => {
          setCategoryOpen(false);
          setCategoryName('');
          setCategoryIcon(undefined);
        }}
        width={360}
        destroyOnClose
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button
              onClick={() => {
                setCategoryOpen(false);
                setCategoryName('');
                setCategoryIcon(undefined);
              }}
            >
              Cancel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleCreateCategory()}>
              Create
            </Button>
          </Flex>
        }
      >
        <Form layout="vertical">
          <Form.Item label="Category name" required>
            <Input
              placeholder="e.g. News, Shopping"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              maxLength={40}
              prefix={<AppstoreOutlined />}
            />
          </Form.Item>
          <Form.Item
            label="Icon (optional)"
            extra="If you skip this, a default icon will be used."
          >
            <Flex align="center" gap={12}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: isDarkMode ? '#1f1f1f' : '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {categoryIcon ? (
                  <img
                    src={categoryIcon}
                    alt=""
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                  />
                ) : (
                  <AppstoreOutlined style={{ fontSize: 20, color: token.colorTextSecondary }} />
                )}
              </div>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  void fileToDataUrl(file).then(setCategoryIcon);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>Upload icon</Button>
              </Upload>
              {categoryIcon && (
                <Button type="link" onClick={() => setCategoryIcon(undefined)}>
                  Use default
                </Button>
              )}
            </Flex>
          </Form.Item>
        </Form>
      </Drawer>

      <HostDetailsModal
        open={hostOpen}
        isDarkMode={isDarkMode}
        serverType={selected?.id || 'ubuntu'}
        serverName={selected?.name || 'Server'}
        onCancel={() => {
          setHostOpen(false);
          setSelected(null);
        }}
        onConnect={confirmHostConnect}
      />

      <style>{`
        .tn-add-pill.ant-btn-primary {
          background: #ffffff !important;
          color: #111111 !important;
        }
        .tn-add-pill.ant-btn-primary:hover {
          background: #e8e8e8 !important;
          color: #111111 !important;
        }
        .tn-add-pill.ant-btn-primary .anticon {
          color: #111111 !important;
        }
        .tn-available-services.is-dark .ant-layout,
        .tn-available-services.is-dark .ant-layout-sider,
        .tn-available-services.is-dark .ant-layout-sider-dark {
          background: #000000 !important;
        }
        .tn-available-services.is-dark .ant-layout-content.tn-available-services-content {
          background: #000000 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          min-height: 0 !important;
        }
        .tn-available-services .ant-layout {
          min-height: 0 !important;
        }
      `}</style>
    </div>
  );
}
