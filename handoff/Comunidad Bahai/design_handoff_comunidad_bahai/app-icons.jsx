// app-icons.jsx — Shared icons, star, and tab bar for Bahá'í Community App

// ─── 9-Pointed Bahá'í Star ───
const BahaiStar = ({ size = 24, color = 'currentColor', opacity = 1, style = {} }) => {
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const oA = (i * 40 - 90) * Math.PI / 180;
    const iA = ((i * 40 + 20) - 90) * Math.PI / 180;
    pts.push(`${50 + 44 * Math.cos(oA)},${50 + 44 * Math.sin(oA)}`);
    pts.push(`${50 + 22 * Math.cos(iA)},${50 + 22 * Math.sin(iA)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity, ...style }}>
      <polygon points={pts.join(' ')} fill={color} />
    </svg>
  );
};

// ─── Base SVG wrapper ───
const SvgIcon = ({ children, size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </svg>
);

// ─── Section Icons ───
const IconMensajes = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </SvgIcon>
);

const IconChat = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </SvgIcon>
);

const IconActividades = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </SvgIcon>
);

const IconCalendario = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </SvgIcon>
);

const IconServicio = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </SvgIcon>
);

const IconMateriales = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </SvgIcon>
);

const IconMetas = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </SvgIcon>
);

const IconTesoreria = ({ size = 24 }) => (
  <SvgIcon size={size}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </SvgIcon>
);

const IconHome = ({ size = 22 }) => (
  <SvgIcon size={size}>
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
  </SvgIcon>
);

const IconMore = ({ size = 22 }) => (
  <SvgIcon size={size}>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
  </SvgIcon>
);

const Chevron = ({ color = '#999' }) => (
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
    <path d="M1 1l5 5-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Tab Bar ───
const TabBar = ({ activeIndex = 0, accentColor = '#B8952E', bgColor = '#fff', textColor = '#999', style = {} }) => {
  const tabs = [
    { icon: IconHome, label: 'Inicio' },
    { icon: IconMensajes, label: 'Mensajes' },
    { icon: IconCalendario, label: 'Calendario' },
    { icon: IconServicio, label: 'Servicio' },
    { icon: IconMore, label: 'Más' },
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '10px 0 34px', background: bgColor,
      borderTop: '1px solid rgba(0,0,0,0.06)',
      flexShrink: 0, ...style,
    }}>
      {tabs.map((tab, i) => {
        const Icon = tab.icon;
        const active = i === activeIndex;
        return (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: active ? accentColor : textColor,
          }}>
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: 0.1 }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, {
  BahaiStar, SvgIcon, Chevron,
  IconMensajes, IconChat, IconActividades, IconCalendario,
  IconServicio, IconMateriales, IconMetas, IconTesoreria,
  IconHome, IconMore, TabBar,
});
