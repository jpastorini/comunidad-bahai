// proto-app.jsx — Interactive prototype router

const { useState } = React;

const ProtoApp = () => {
  const [screen, setScreen] = useState('home');

  const screens = {
    home: ProtoHome,
    mensajes: ProtoMensajes,
    chat: ProtoChat,
    actividades: ProtoActividades,
    calendario: ProtoCalendario,
    servicio: ProtoServicio,
    materiales: ProtoMateriales,
    metas: ProtoMetas,
    tesoreria: ProtoTesoreria,
    mas: ProtoMas,
  };

  const Screen = screens[screen] || ProtoHome;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#1a1a1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <IOSDevice dark={true} width={402} height={874}>
        <Screen onNavigate={setScreen} />
      </IOSDevice>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<ProtoApp />);
