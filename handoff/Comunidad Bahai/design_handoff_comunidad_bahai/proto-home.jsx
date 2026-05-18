// proto-home.jsx — Interactive home screen with clickable navigation

const ProtoHome = ({ onNavigate }) => {
  const sections = [
    { icon: IconMensajes, title: 'Mensajes', sub: 'Casa Universal', c: hColors.terra, badge: 'Nuevo', screen: 'mensajes' },
    { icon: IconChat, title: 'Secretar\u00EDa', sub: 'Local', c: hColors.amber, badge: '2', screen: 'chat' },
    { icon: IconActividades, title: 'Actividades', sub: 'Locales', c: hColors.terra, badge: '3', screen: 'actividades' },
    { icon: IconCalendario, title: 'Calendario', sub: 'Mayo 2026', c: hColors.amber, screen: 'calendario' },
    { icon: IconServicio, title: 'Servicio', sub: 'Necesidades', c: hColors.terra, badge: '5', screen: 'servicio' },
    { icon: IconMateriales, title: 'Materiales', sub: 'de Estudio', c: hColors.amber, screen: 'materiales' },
    { icon: IconMetas, title: 'Metas', sub: 'Ense\u00F1anza', c: hColors.terra, screen: 'metas' },
    { icon: IconTesoreria, title: 'Tesorer\u00EDa', sub: '65% meta', c: hColors.amber, progress: 0.65, screen: 'tesoreria' },
  ];

  const activities = [
    { title: 'C\u00EDrculo de Estudio', sub: 'Libro 7, Unidad 2', when: 'Vie 22', time: '7:00 PM' },
    { title: 'Reuni\u00F3n Devocional', sub: 'Casa de los Garc\u00EDa', when: 'Dom 24', time: '10:00 AM' },
  ];

  return (
    <Shell tab="home" onNavigate={onNavigate}>
      {/* Gold Header */}
      <div style={{
        background: `linear-gradient(160deg, ${hColors.goldDark}, ${hColors.gold})`,
        paddingTop: 62, paddingBottom: 20, paddingLeft: 22, paddingRight: 22,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', top: 28, right: -12, opacity: 0.07 }}>
          <BahaiStar size={130} color="#fff" />
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 27, fontWeight: 600, color: '#fff',
          letterSpacing: 0.3, lineHeight: 1.15, position: 'relative',
        }}>{"Comunidad Bah\u00E1\u2019\u00ED"}</div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 2.5, textTransform: 'uppercase' }}>
            Centro de Comunicados
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: "'Outfit', sans-serif" }}>
            17 mayo, 2026
          </span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 13px 0' }}>
        {/* Featured Message */}
        <div onClick={() => onNavigate('mensajes')} style={{
          background: `linear-gradient(135deg, ${hColors.terra}, ${hColors.terraLight})`,
          borderRadius: 18, padding: '15px 18px', marginBottom: 12,
          position: 'relative', overflow: 'hidden', cursor: 'pointer',
        }}>
          <div style={{ position: 'absolute', bottom: -12, right: -8, opacity: 0.06 }}>
            <BahaiStar size={80} color="#fff" />
          </div>
          <div style={{
            fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: 7,
          }}>{"\u2726 Mensaje reciente"}</div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.25, marginBottom: 4,
          }}>{"Mensaje del Ri\u1E0Dv\u00E1n 2026"}</div>
          <div style={{
            fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
            fontFamily: "'Outfit', sans-serif", marginBottom: 10,
          }}>{"A los bah\u00E1\u2019\u00EDs del mundo \u2014 En este momento decisivo..."}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#fff' }}>
            Leer mensaje
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M7 3l3 3-3 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Section Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} onClick={() => onNavigate(s.screen)} style={{
                background: hColors.card, borderRadius: 14, padding: '14px 10px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                boxShadow: '0 2px 6px rgba(42,31,20,0.04)', position: 'relative', cursor: 'pointer',
              }}>
                {s.badge && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: s.badge === 'Nuevo' ? hColors.terra : `${hColors.terra}15`,
                    color: s.badge === 'Nuevo' ? '#fff' : hColors.terra,
                    fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: 0.3,
                  }}>{s.badge}</div>
                )}
                <div style={{
                  width: 42, height: 42, borderRadius: 13, background: `${s.c}10`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c,
                }}><Icon size={20} /></div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: hColors.dark, lineHeight: 1.2 }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: hColors.muted, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>{s.sub}</div>
                </div>
                {s.progress !== undefined && (
                  <div style={{ width: '75%', height: 4, borderRadius: 2, background: `${hColors.amber}20`, marginTop: -2 }}>
                    <div style={{ width: `${s.progress * 100}%`, height: '100%', borderRadius: 2, background: hColors.amber }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upcoming Activities */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: hColors.dark, marginBottom: 9 }}>
            {"Pr\u00F3ximamente"}
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            {activities.map((a, i) => (
              <div key={i} onClick={() => onNavigate('actividades')} style={{
                flex: 1, background: hColors.card, borderRadius: 14, padding: 12,
                boxShadow: '0 2px 6px rgba(42,31,20,0.04)', cursor: 'pointer',
              }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 600, color: hColors.terra,
                  textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5,
                }}>{a.when} {"\u00B7"} {a.time}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: hColors.dark, lineHeight: 1.3, marginBottom: 3 }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 10.5, color: hColors.muted, fontFamily: "'Outfit', sans-serif" }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
};

Object.assign(window, { ProtoHome });
