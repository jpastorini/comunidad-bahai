// proto-screens.jsx — All inner screens for the interactive prototype

// ═══════════════════════════════════════════
// MENSAJES
// ═══════════════════════════════════════════
const ProtoMensajes = ({ onNavigate }) => {
  const messages = [
    { date: '20 Abr 2026', title: 'Mensaje del Ri\u1E0Dv\u00E1n 2026', excerpt: 'A los bah\u00E1\u2019\u00EDs del mundo \u2014 En este momento decisivo de la historia humana...', nuevo: true },
    { date: '26 Nov 2025', title: 'Mensaje del D\u00EDa de la Alianza', excerpt: 'Queridos amigos \u2014 El Convenio constituye la fuerza que sostiene...', nuevo: false },
    { date: '1 Ene 2026', title: 'Mensaje a los Bah\u00E1\u2019\u00EDs del Mundo', excerpt: 'Querid\u00EDsimos amigos \u2014 Al comenzar un nuevo a\u00F1o...', nuevo: false },
    { date: '20 Abr 2025', title: 'Mensaje del Ri\u1E0Dv\u00E1n 2025', excerpt: 'A los bah\u00E1\u2019\u00EDs del mundo \u2014 Las fuerzas transformadoras...', nuevo: false },
    { date: '28 Nov 2024', title: 'Sobre el Plan de Nueve A\u00F1os', excerpt: 'Querid\u00EDsimos amigos \u2014 Con sentimientos de profunda gratitud...', nuevo: false },
  ];
  return (
    <Shell tab="mensajes" onNavigate={onNavigate}>
      <GoldHeader title="Mensajes" subtitle="Casa Universal de Justicia" onBack={() => onNavigate('home')} />
      <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${hColors.gold}08`, borderRadius: 12, padding: '10px 14px' }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke={hColors.muted} strokeWidth="1.3" /><path d="M10 10l4 4" stroke={hColors.muted} strokeWidth="1.3" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 13, color: hColors.muted, fontFamily: "'Outfit', sans-serif" }}>Buscar mensaje...</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 0' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ padding: '13px 0', borderBottom: i < messages.length - 1 ? '1px solid rgba(42,63,143,0.08)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: hColors.terra, fontWeight: 600, letterSpacing: 0.3 }}>{m.date}</span>
              {m.nuevo && <span style={{ fontSize: 8, background: hColors.terra, color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>Nuevo</span>}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: hColors.dark, lineHeight: 1.3, marginBottom: 4 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: hColors.muted, lineHeight: 1.5, fontFamily: "'Outfit', sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.excerpt}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════
const ProtoChat = ({ onNavigate }) => {
  const msgs = [
    { from: 'them', text: 'Buenos d\u00EDas, \u00BFen qu\u00E9 podemos ayudarle?', time: '9:15' },
    { from: 'me', text: 'Quisiera informaci\u00F3n sobre las pr\u00F3ximas actividades.', time: '9:16' },
    { from: 'them', text: 'Tenemos un c\u00EDrculo de estudio del Libro 7 este viernes a las 7 PM y una reuni\u00F3n devocional el domingo.', time: '9:17' },
    { from: 'me', text: '\u00BFD\u00F3nde se realiza el c\u00EDrculo de estudio?', time: '9:18' },
    { from: 'them', text: 'En la casa de la familia Rodr\u00EDguez. \u00BFLe gustar\u00EDa confirmar su asistencia?', time: '9:19' },
  ];
  return (
    <Shell tab="mas" onNavigate={onNavigate}>
      <div style={{
        background: `linear-gradient(160deg, ${hColors.goldDark}, ${hColors.gold})`,
        paddingTop: 62, paddingBottom: 14, paddingLeft: 20, paddingRight: 20, flexShrink: 0,
      }}>
        <div onClick={() => onNavigate('home')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Inicio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>S</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', fontFamily: "'Sora', sans-serif" }}>{"Secretar\u00EDa Local"}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#7ECF8B' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{"En l\u00EDnea"}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: "'Outfit', sans-serif" }}>
        {msgs.map((m, i) => {
          const mine = m.from === 'me';
          return (
            <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{
                background: mine ? hColors.terra : hColors.card, color: mine ? '#fff' : hColors.dark,
                borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
                boxShadow: mine ? 'none' : '0 1px 4px rgba(42,31,20,0.06)',
              }}>{m.text}</div>
              <div style={{ fontSize: 9.5, color: hColors.muted, marginTop: 3, textAlign: mine ? 'right' : 'left', padding: '0 4px' }}>{m.time}</div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px 38px', background: hColors.card, borderTop: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: hColors.bg, borderRadius: 24, padding: '10px 14px' }}>
          <span style={{ flex: 1, fontSize: 13, color: '#aaa', fontFamily: "'Outfit', sans-serif" }}>Escribe un mensaje...</span>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: hColors.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M13 1L6.5 7.5M13 1L8.5 13L6.5 7.5M13 1L1 5.5L6.5 7.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// ACTIVIDADES
// ═══════════════════════════════════════════
const ProtoActividades = ({ onNavigate }) => {
  const items = [
    { type: 'Estudio', title: 'C\u00EDrculo de Estudio', detail: 'Libro 7, Unidad 2', when: 'Vie 22 mayo', time: '7:00 PM', place: 'Casa Rodr\u00EDguez' },
    { type: 'Devocional', title: 'Reuni\u00F3n Devocional', detail: 'Oraciones y m\u00FAsica', when: 'Dom 24 mayo', time: '10:00 AM', place: 'Casa Garc\u00EDa' },
    { type: 'Ni\u00F1os', title: 'Clase de Ni\u00F1os', detail: 'Grado 2, Lecci\u00F3n 5', when: 'S\u00E1b 23 mayo', time: '4:00 PM', place: 'Centro Comunitario' },
    { type: 'J\u00F3venes', title: 'Grupo de Prejuniors', detail: 'Caminando el sendero', when: 'Mi\u00E9 27 mayo', time: '5:30 PM', place: 'Casa L\u00F3pez' },
  ];
  const tc = (t) => t === 'Estudio' ? hColors.terra : t === 'Devocional' ? hColors.amber : t.includes('os') ? '#6A8B5F' : hColors.gold;
  return (
    <Shell tab="mas" onNavigate={onNavigate}>
      <GoldHeader title="Actividades" subtitle={"Pr\u00F3ximas actividades de la comunidad"} onBack={() => onNavigate('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((a, i) => {
            const color = tc(a.type);
            return (
              <div key={i} style={{ background: hColors.card, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 6px rgba(42,31,20,0.04)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 48, minHeight: 52, borderRadius: 12, background: `${color}10`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1, fontFamily: "'Cormorant Garamond', serif" }}>{a.when.split(' ')[1]}</div>
                  <div style={{ fontSize: 9, color, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, marginTop: 2 }}>{a.when.split(' ')[2] || a.when.split(' ')[0]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'inline-block', fontSize: 8.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, background: `${color}10`, padding: '2px 7px', borderRadius: 4, marginBottom: 5 }}>{a.type}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: hColors.dark, lineHeight: 1.3, marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: hColors.muted, fontFamily: "'Outfit', sans-serif", marginBottom: 3 }}>{a.detail}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: hColors.muted, fontFamily: "'Outfit', sans-serif" }}>
                    <span>{a.time}</span><span>{"\u00B7"}</span><span>{a.place}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// TESORERÍA
// ═══════════════════════════════════════════
const ProtoTesoreria = ({ onNavigate }) => {
  const r = 56, circ = 2 * Math.PI * r, off = circ * 0.35;
  return (
    <Shell tab="mas" onNavigate={onNavigate}>
      <GoldHeader title={"Tesorer\u00EDa"} onBack={() => onNavigate('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        <div style={{ background: hColors.card, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 10px rgba(42,31,20,0.05)', marginBottom: 14 }}>
          <div style={{ position: 'relative', width: 128, height: 128, marginBottom: 14 }}>
            <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="64" cy="64" r={r} fill="none" stroke={`${hColors.amber}18`} strokeWidth="9" />
              <circle cx="64" cy="64" r={r} fill="none" stroke={hColors.amber} strokeWidth="9" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, color: hColors.dark }}>65%</div>
              <div style={{ fontSize: 10, color: hColors.muted, fontFamily: "'Outfit', sans-serif" }}>de la meta</div>
            </div>
          </div>
          <div style={{ fontSize: 15, color: hColors.dark, fontWeight: 600 }}>$3,250 de $5,000</div>
          <div style={{ fontSize: 11, color: hColors.muted, marginTop: 3, fontFamily: "'Outfit', sans-serif" }}>Meta anual del Fondo</div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: hColors.dark, marginBottom: 10 }}>{"C\u00F3mo aportar"}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ l: 'Transferencia', s: 'Datos bancarios', t: 'T' }, { l: 'Efectivo', s: 'En reuni\u00F3n', t: 'E' }].map((m, i) => (
              <div key={i} style={{ flex: 1, background: hColors.card, borderRadius: 16, padding: 13, boxShadow: '0 1px 4px rgba(42,31,20,0.04)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: `${hColors.terra}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: hColors.terra, fontWeight: 700, fontSize: 14, fontFamily: "'Cormorant Garamond', serif", marginBottom: 8 }}>{m.t}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: hColors.dark }}>{m.l}</div>
                <div style={{ fontSize: 10.5, color: hColors.muted, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>{m.s}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: hColors.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(42,31,20,0.04)', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark, marginBottom: 10 }}>Informe mensual</div>
          {[{ l: 'Ingresos del mes', a: '$450' }, { l: 'Fondo Nacional', a: '$150' }, { l: 'Fondo Continental', a: '$50' }, { l: 'Fondo Local', a: '$250' }].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(42,63,143,0.06)' : 'none' }}>
              <span style={{ fontSize: 12, color: hColors.muted, fontFamily: "'Outfit', sans-serif" }}>{item.l}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: hColors.dark }}>{item.a}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// CALENDARIO
// ═══════════════════════════════════════════
const ProtoCalendario = ({ onNavigate }) => {
  const days = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'S\u00E1', 'Do'];
  // May 2026 starts on Friday (index 4 in Lu-based week)
  const blanks = 4;
  const totalDays = 31;
  const events = { 17: 'Hoy', 22: 'Estudio', 23: 'Ni\u00F1os', 24: 'Devocional', 27: 'Prejuniors' };
  const eventList = [
    { day: 22, title: 'C\u00EDrculo de Estudio', time: '7:00 PM', color: hColors.terra },
    { day: 23, title: 'Clase de Ni\u00F1os', time: '4:00 PM', color: '#6A8B5F' },
    { day: 24, title: 'Reuni\u00F3n Devocional', time: '10:00 AM', color: hColors.amber },
    { day: 27, title: 'Grupo de Prejuniors', time: '5:30 PM', color: hColors.gold },
  ];

  return (
    <Shell tab="calendario" onNavigate={onNavigate}>
      <GoldHeader title="Calendario" subtitle="Mayo 2026" onBack={() => onNavigate('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        {/* Calendar Grid */}
        <div style={{ background: hColors.card, borderRadius: 18, padding: 16, boxShadow: '0 2px 8px rgba(42,31,20,0.04)', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {days.map(d => (
              <div key={d} style={{ fontSize: 10, fontWeight: 600, color: hColors.muted, padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
            {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const isToday = day === 17;
              const hasEvent = events[day];
              return (
                <div key={day} style={{
                  width: 36, height: 36, borderRadius: 18, margin: '2px auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: isToday || hasEvent ? 600 : 400,
                  background: isToday ? hColors.terra : hasEvent ? `${hColors.terra}10` : 'transparent',
                  color: isToday ? '#fff' : hasEvent ? hColors.terra : hColors.dark,
                }}>{day}</div>
              );
            })}
          </div>
        </div>
        {/* Event List */}
        <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark, marginBottom: 10 }}>{"Pr\u00F3ximos eventos"}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 14 }}>
          {eventList.map((e, i) => (
            <div key={i} style={{ background: hColors.card, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(42,31,20,0.04)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${e.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, color: e.color }}>{e.day}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark }}>{e.title}</div>
                <div style={{ fontSize: 11, color: hColors.muted, fontFamily: "'Outfit', sans-serif", marginTop: 2 }}>{e.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// MATERIALES DE ESTUDIO
// ═══════════════════════════════════════════
const ProtoMateriales = ({ onNavigate }) => {
  const ruhi = [
    { n: 1, title: 'Reflexiones sobre la vida del esp\u00EDritu', done: true },
    { n: 2, title: 'Levant\u00E1ndose para servir', done: true },
    { n: 3, title: 'Ense\u00F1ando clases de ni\u00F1os (Grado 1)', done: true },
    { n: 4, title: 'Las manifestaciones gemelas', done: true },
    { n: 5, title: 'Liberando los poderes de los prej\u00F3venes', done: false },
    { n: 6, title: 'Ense\u00F1ando la Causa', done: true },
    { n: 7, title: 'Caminando juntos en un sendero de servicio', done: false, current: true },
    { n: 8, title: 'El Convenio de Bah\u00E1\u2019u\u2019ll\u00E1h', done: false },
  ];
  const otros = [
    { title: 'Oraciones selectas', sub: 'Compilaci\u00F3n' },
    { title: 'Palabras Ocultas', sub: 'Escritos sagrados' },
    { title: 'Kit\u00E1b-i-\u00CDq\u00E1n', sub: 'Escritos sagrados' },
  ];
  return (
    <Shell tab="mas" onNavigate={onNavigate}>
      <GoldHeader title="Materiales" subtitle="de Estudio" onBack={() => onNavigate('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark, marginBottom: 10 }}>Instituto Ruh\u00ED</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {ruhi.map((b, i) => (
            <div key={i} style={{ background: hColors.card, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(42,31,20,0.03)' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: b.current ? hColors.terra : b.done ? `${hColors.terra}12` : `${hColors.muted}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: b.current ? '#fff' : b.done ? hColors.terra : hColors.muted,
                fontSize: 13, fontWeight: 700,
              }}>{b.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: hColors.dark, lineHeight: 1.3 }}>{b.title}</div>
              </div>
              {b.done && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke={hColors.terra} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {b.current && <span style={{ fontSize: 8, background: `${hColors.amber}15`, color: hColors.amber, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>En curso</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark, marginBottom: 10 }}>Escritos y Oraciones</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 14 }}>
          {otros.map((o, i) => (
            <div key={i} style={{ background: hColors.card, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(42,31,20,0.03)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${hColors.amber}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: hColors.amber }}><IconMateriales size={16} /></div>
              <div><div style={{ fontSize: 12, fontWeight: 600, color: hColors.dark }}>{o.title}</div><div style={{ fontSize: 10, color: hColors.muted, marginTop: 1 }}>{o.sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// METAS DE ENSEÑANZA
// ═══════════════════════════════════════════
const ProtoMetas = ({ onNavigate }) => {
  const metrics = [
    { label: 'C\u00EDrculos de estudio', current: 3, goal: 5, color: hColors.terra },
    { label: 'Devocionales', current: 4, goal: 6, color: hColors.amber },
    { label: 'Clases de ni\u00F1os', current: 2, goal: 4, color: '#6A8B5F' },
    { label: 'Grupos de prejuniors', current: 1, goal: 3, color: hColors.gold },
  ];
  const stats = [
    { n: '47', label: 'Participantes activos' },
    { n: '12', label: 'Nuevos este ciclo' },
    { n: '8', label: 'Tutores' },
  ];
  return (
    <Shell tab="mas" onNavigate={onNavigate}>
      <GoldHeader title="Metas" subtitle={"Metas de ense\u00F1anza \u2014 Ciclo actual"} onBack={() => onNavigate('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: 1, background: hColors.card, borderRadius: 14, padding: '14px 10px', textAlign: 'center', boxShadow: '0 2px 6px rgba(42,31,20,0.04)' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: hColors.terra }}>{s.n}</div>
              <div style={{ fontSize: 9.5, color: hColors.muted, marginTop: 3, fontFamily: "'Outfit', sans-serif", lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Activity Goals */}
        <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark, marginBottom: 10 }}>Actividades b\u00E1sicas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ background: hColors.card, borderRadius: 14, padding: 14, boxShadow: '0 1px 4px rgba(42,31,20,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: hColors.dark }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.current}/{m.goal}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: `${m.color}15` }}>
                <div style={{ width: `${(m.current / m.goal) * 100}%`, height: '100%', borderRadius: 3, background: m.color, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// NECESIDADES DE SERVICIO
// ═══════════════════════════════════════════
const ProtoServicio = ({ onNavigate }) => {
  const needs = [
    { title: 'Tutores para Libro 1', desc: 'Se necesitan 2 tutores para un nuevo c\u00EDrculo de estudio', urgency: 'Alta', color: hColors.terra },
    { title: 'Anfitri\u00F3n devocional', desc: 'Hogar para reuniones devocionales los domingos', urgency: 'Media', color: hColors.amber },
    { title: 'Maestro clase de ni\u00F1os', desc: 'Grado 3, los s\u00E1bados por la tarde', urgency: 'Alta', color: hColors.terra },
    { title: 'Transporte para ancianos', desc: 'Llevar a 2 amigos a las reuniones semanales', urgency: 'Media', color: hColors.amber },
    { title: 'M\u00FAsicos para devocional', desc: 'Acompa\u00F1amiento musical para las reuniones', urgency: 'Baja', color: hColors.gold },
  ];
  return (
    <Shell tab="servicio" onNavigate={onNavigate}>
      <GoldHeader title="Servicio" subtitle="Necesidades de la comunidad" onBack={() => onNavigate('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14 }}>
          {needs.map((n, i) => (
            <div key={i} style={{ background: hColors.card, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 6px rgba(42,31,20,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: hColors.dark, lineHeight: 1.3, flex: 1 }}>{n.title}</div>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: n.color, background: `${n.color}12`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', flexShrink: 0, marginLeft: 8 }}>{n.urgency}</span>
              </div>
              <div style={{ fontSize: 12, color: hColors.muted, lineHeight: 1.5, fontFamily: "'Outfit', sans-serif", marginBottom: 10 }}>{n.desc}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: hColors.terra, cursor: 'pointer' }}>
                Ofrecerme como voluntario
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M6 2l3 3-3 3" stroke={hColors.terra} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ═══════════════════════════════════════════
// MÁS (More menu)
// ═══════════════════════════════════════════
const ProtoMas = ({ onNavigate }) => {
  const items = [
    { icon: IconChat, label: 'Secretar\u00EDa Local', sub: 'Chat directo', screen: 'chat', c: hColors.amber },
    { icon: IconActividades, label: 'Actividades Locales', sub: '4 pr\u00F3ximas', screen: 'actividades', c: hColors.terra },
    { icon: IconMateriales, label: 'Materiales de Estudio', sub: 'Libros y escritos', screen: 'materiales', c: hColors.amber },
    { icon: IconMetas, label: 'Metas de Ense\u00F1anza', sub: 'Progreso del ciclo', screen: 'metas', c: hColors.terra },
    { icon: IconTesoreria, label: 'Tesorer\u00EDa', sub: '65% de la meta anual', screen: 'tesoreria', c: hColors.amber },
  ];
  return (
    <Shell tab="mas" onNavigate={onNavigate}>
      <GoldHeader title={"M\u00E1s"} subtitle="Todas las secciones" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} onClick={() => onNavigate(item.screen)} style={{
                background: hColors.card, borderRadius: 14, padding: '13px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 1px 4px rgba(42,31,20,0.04)', cursor: 'pointer',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: `${item.c}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.c, flexShrink: 0 }}>
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: hColors.dark }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: hColors.muted, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>{item.sub}</div>
                </div>
                <Chevron color={hColors.muted} />
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
};

Object.assign(window, { ProtoMensajes, ProtoChat, ProtoActividades, ProtoTesoreria, ProtoCalendario, ProtoMateriales, ProtoMetas, ProtoServicio, ProtoMas });
