// proto-nav.jsx — Shared navigation components for interactive prototype

const NavTabBar = ({ active, onNavigate }) => {
  const tabs = [
    { icon: IconHome, label: 'Inicio', id: 'home' },
    { icon: IconMensajes, label: 'Mensajes', id: 'mensajes' },
    { icon: IconCalendario, label: 'Calendario', id: 'calendario' },
    { icon: IconServicio, label: 'Servicio', id: 'servicio' },
    { icon: IconMore, label: 'M\u00E1s', id: 'mas' },
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '10px 0 34px', background: hColors.card,
      borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
    }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <div key={t.id} onClick={() => onNavigate(t.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: isActive ? hColors.terra : hColors.muted, cursor: 'pointer',
          }}>
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const GoldHeader = ({ title, subtitle, onBack, children }) => (
  <div style={{
    background: `linear-gradient(160deg, ${hColors.goldDark}, ${hColors.gold})`,
    paddingTop: 62, paddingBottom: 18, paddingLeft: 20, paddingRight: 20,
    flexShrink: 0, position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 20, right: -15, opacity: 0.05 }}>
      <BahaiStar size={100} color="#fff" />
    </div>
    {onBack && (
      <div onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer',
      }}>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M7 1L1 7l6 6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Inicio</span>
      </div>
    )}
    <div style={{
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      fontSize: 28, fontWeight: 700, color: '#fff', position: 'relative',
    }}>{title}</div>
    {subtitle && (
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3, fontFamily: "'Outfit', sans-serif" }}>
        {subtitle}
      </div>
    )}
    {children}
  </div>
);

const Shell = ({ children, tab, onNavigate }) => (
  <div style={{
    height: '100%', display: 'flex', flexDirection: 'column',
    background: hColors.bg, fontFamily: "'Sora', sans-serif",
  }}>
    {children}
    <NavTabBar active={tab} onNavigate={onNavigate} />
  </div>
);

Object.assign(window, { NavTabBar, GoldHeader, Shell });
