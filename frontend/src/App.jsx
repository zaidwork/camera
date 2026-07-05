import React, { useState, useEffect } from 'react';
import CameraFeed from './components/CameraFeed';
import DashboardStats from './components/DashboardStats';
import FaceAnalyzerGame from './components/FaceAnalyzerGame';
import { Shield, ShieldAlert, Monitor, Gamepad2, Info, Settings, RefreshCw } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('monitor');
  const [peopleCount, setPeopleCount] = useState(0);
  const [objects, setObjects] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [faceAnalyses, setFaceAnalyses] = useState({});
  const [gameState, setGameState] = useState({ active: false, score: 0, high_score: 0 });
  const [logs, setLogs] = useState([]);
  const [timeStr, setTimeStr] = useState('');
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [wsUrlInput, setWsUrlInput] = useState('');
  const [wsUrl, setWsUrl] = useState('');

  // Keep track of previously detected objects to log when they appear/disappear
  const [prevObjects, setPrevObjects] = useState([]);

  // Load and calculate default WebSocket URL
  useEffect(() => {
    const serverIp = window.location.hostname || "localhost";
    // Check if we have a saved URL in localStorage
    const savedUrl = localStorage.getItem('laring_ws_url');
    
    let defaultUrl = `ws://${serverIp}:8000/ws`;
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) {
      if (envWsUrl.startsWith('http://') || envWsUrl.startsWith('https://')) {
        defaultUrl = envWsUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
      } else {
        // If it's just a hostname, use wss://
        defaultUrl = `wss://${envWsUrl}/ws`;
      }
    }
    
    const activeUrl = savedUrl || defaultUrl;
    setWsUrl(activeUrl);
    setWsUrlInput(activeUrl);
  }, []);

  // Fetch historical alerts from Supabase via backend API
  useEffect(() => {
    if (!wsUrl) return;
    
    // Derive HTTP base URL from WebSocket URL
    let httpBaseUrl = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
    
    fetch(`${httpBaseUrl}/api/history/alerts`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Format historical logs to match the local logs format
          const formattedLogs = data.map(item => {
            const date = new Date(item.created_at);
            const time = date.toTimeString().split(' ')[0];
            return {
              time,
              text: translateAlert(item.message),
              timestamp: date.getTime()
            };
          });
          // Sort by timestamp ascending (reverse of DESC) so they append properly
          setLogs(formattedLogs.reverse());
        }
      })
      .catch(err => console.error("Error loading historical logs:", err));
  }, [wsUrl]);

  const translateObject = (name) => {
    const dict = {
      'person': 'شخص',
      'ruler': 'مسطرة',
      'lighter': 'ولاعة',
      'cell phone': 'هاتف محمول',
      'bottle': 'زجاجة',
      'cup': 'كوب',
      'pen': 'قلم',
      'scissors': 'مقص',
      'book': 'كتاب'
    };
    return dict[name.toLowerCase()] || name;
  };

  const translateAlert = (msg) => {
    let res = msg;
    res = res.replace(/Person (\d+) hit Person (\d+)! \(Sudden velocity: ([\d.]+)px\/fr\)/, 'قام الشخص $1 بضرب الشخص $2! (السرعة المفاجئة: $3 بكسل/إطار)');
    res = res.replace(/Physical contact: Person (\d+) touching Person (\d+)/, 'تلامس جسدي: الشخص $1 يلمس الشخص $2');
    return res;
  };

  const handleMetadataReceived = (data) => {
    const timestamp = new Date().toTimeString().split(' ')[0];

    // 1. Update general stats
    if (data.people_count !== undefined) {
      if (data.people_count !== peopleCount) {
        addLog(timestamp, `تغيير في الحضور: يوجد حالياً ${data.people_count} أشخاص في الغرفة`);
        setPeopleCount(data.people_count);
      }
    }

    if (data.objects !== undefined) {
      setObjects(data.objects);
      
      // Log new objects detected
      const newItems = data.objects.filter(x => !prevObjects.includes(x));
      newItems.forEach(item => {
        const hLabel = translateObject(item);
        const isFlagged = ["lighter", "ruler"].includes(item.toLowerCase());
        const typeStr = isFlagged ? "تحذير: أداة مشبوهة" : "أداة عادية";
        addLog(timestamp, `[رصد أداة] تم كشف ${typeStr} '${hLabel}' في الغرفة`);
      });
      setPrevObjects(data.objects);
    }

    if (data.alerts !== undefined) {
      setAlerts(data.alerts);
      
      // Log critical security events
      data.alerts.forEach(alert => {
        const translatedMsg = translateAlert(alert.message);
        const alreadyLogged = logs.some(l => l.text === translatedMsg && (Date.now() - l.timestamp) < 5000);
        if (!alreadyLogged) {
          const typePrefix = alert.type === "aggression" ? "[إنذار عنف]" : "[تلامس جسدي]";
          addLog(timestamp, `${typePrefix} ${translatedMsg}`);
        }
      });
    }

    if (data.analyses !== undefined) {
      setFaceAnalyses(data.analyses);
    }

    if (data.game !== undefined) {
      setGameState(data.game);
    }
  };

  const addLog = (time, text) => {
    setLogs((prev) => {
      const updated = [...prev, { time, text, timestamp: Date.now() }];
      if (updated.length > 80) {
        updated.shift();
      }
      return updated;
    });
  };

  const saveSettings = () => {
    localStorage.setItem('laring_ws_url', wsUrlInput);
    setWsUrl(wsUrlInput);
    setShowSettings(false);
    addLog(new Date().toTimeString().split(' ')[0], `[نظام] تم حفظ رابط الخادم الجديد: ${wsUrlInput}`);
    // Force page reload to reconnect with new websocket
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const resetSettings = () => {
    const serverIp = window.location.hostname || "localhost";
    let defaultUrl = `ws://${serverIp}:8000/ws`;
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) {
      if (envWsUrl.startsWith('http://') || envWsUrl.startsWith('https://')) {
        defaultUrl = envWsUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
      } else {
        defaultUrl = `wss://${envWsUrl}/ws`;
      }
    }
    localStorage.removeItem('laring_ws_url');
    setWsUrlInput(defaultUrl);
    setWsUrl(defaultUrl);
    setShowSettings(false);
    addLog(new Date().toTimeString().split(' ')[0], `[نظام] تم استعادة عنوان الاتصال الافتراضي`);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const hasAggression = alerts && alerts.some(a => a.type === "aggression");

  return (
    <div className="flex flex-col gap-4" dir="rtl" style={{ minHeight: '100vh', padding: '8px' }}>
      {/* Header */}
      <header className="glass-panel flex-between flex-wrap gap-4 pb-4">
        <div className="flex-center-gap">
          <div className="flex p-3" style={{
            borderRadius: '12px',
            border: '1px solid',
            borderColor: hasAggression ? 'var(--neon-red)' : 'var(--neon-cyan)',
            backgroundColor: hasAggression ? 'rgba(255, 0, 60, 0.1)' : 'rgba(0, 240, 255, 0.1)',
            color: hasAggression ? 'var(--neon-red)' : 'var(--neon-cyan)',
            animation: hasAggression ? 'pulse-red 1.5s infinite' : 'none'
          }}>
            {hasAggression ? <ShieldAlert className="w-6 h-6 animate-bounce" /> : <Shield className="w-6 h-6" />}
          </div>
          <div className="flex-col">
            <h1 className="cyber-font text-white flex-center-gap" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              حارس <span className="text-[var(--neon-cyan)] glitch-text">Laring AI</span>
            </h1>
            <p className="cyber-font text-transparent bg-clip-text bg-gradient-to-r from-[var(--neon-cyan)] to-blue-400" style={{ fontSize: '10px', marginTop: '4px' }}>
              نظام المراقبة العصبية والمسح البيومتري للوجه والجسد
            </p>
          </div>
        </div>

        {/* Navigation & Telemetry Clock */}
        <div className="flex-center-gap flex-wrap">
          <div className="flex p-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px' }}>
            <button
              onClick={() => setActiveTab('monitor')}
              className="cyber-btn"
              style={{
                background: activeTab === 'monitor' ? 'var(--neon-cyan)' : 'transparent',
                color: activeTab === 'monitor' ? '#080a0f' : 'var(--text-secondary)',
                border: 'none',
                boxShadow: activeTab === 'monitor' ? '0 0 10px rgba(0,240,255,0.3)' : 'none',
                textShadow: 'none',
                padding: '8px 16px',
                borderRadius: '6px'
              }}
            >
              <Monitor className="w-4 h-4" />
              المراقبة الحية
            </button>
            <button
              onClick={() => setActiveTab('game')}
              className="cyber-btn"
              style={{
                background: activeTab === 'game' ? 'var(--neon-cyan)' : 'transparent',
                color: activeTab === 'game' ? '#080a0f' : 'var(--text-secondary)',
                border: 'none',
                boxShadow: activeTab === 'game' ? '0 0 10px rgba(0,240,255,0.3)' : 'none',
                textShadow: 'none',
                padding: '8px 16px',
                borderRadius: '6px'
              }}
            >
              <Gamepad2 className="w-4 h-4" />
              سنجار المشاعر والوجه
            </button>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="cyber-btn"
              style={{ padding: '10px', borderRadius: '8px' }}
              title="إعدادات خادم الاتصال"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            <div className="cyber-font" style={{
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'var(--neon-cyan)'
            }}>
              ساعة النظام: {timeStr}
            </div>
          </div>
        </div>
      </header>

      {/* Settings slide panel */}
      {showSettings && (
        <div className="glass-panel animate-fade-in mx-4 mb-2 flex-col gap-3" style={{ borderColor: 'var(--neon-magenta)' }}>
          <h3 className="cyber-font text-white" style={{ fontSize: '13px', fontWeight: 800 }}>إعدادات خادم المعالجة الذكي</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            إذا قمت برفع المشروع على Netlify، ستحتاج لاستخدام نفق اتصال آمن (Localtunnel / Ngrok) لخادم بايثون المحتوي على بروتوكول مشفر (wss://).
          </p>
          <div className="flex gap-3 flex-wrap" style={{ width: '100%', alignItems: 'center' }}>
            <input 
              type="text" 
              value={wsUrlInput}
              onChange={(e) => setWsUrlInput(e.target.value)}
              className="cyber-font"
              style={{
                flex: 1,
                minWidth: '260px',
                backgroundColor: 'rgba(0,0,0,0.6)',
                border: '1px solid var(--neon-magenta)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--neon-cyan)',
                outline: 'none'
              }}
              placeholder="مثال: wss://your-tunnel.loca.lt/ws"
            />
            <div className="flex gap-2">
              <button onClick={saveSettings} className="cyber-btn">حفظ وتحديث</button>
              <button onClick={resetSettings} className="cyber-btn cyber-btn-magenta flex-center-gap"><RefreshCw className="w-3.5 h-3.5" /> افتراضي</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 w-full" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 8px' }}>
        {activeTab === 'monitor' ? (
          <div className="dashboard-grid animate-fade-in">
            <div className="flex-col gap-4">
              {wsUrl && <CameraFeed onMetadataReceived={handleMetadataReceived} wsUrl={wsUrl} />}
            </div>
            <div className="flex-col gap-4">
              <DashboardStats 
                peopleCount={peopleCount} 
                objects={objects} 
                alerts={alerts} 
                logs={logs} 
              />
            </div>
          </div>
        ) : (
          <div className="game-grid animate-fade-in">
            <div className="flex-col gap-4">
              <div className="glass-panel flex-col gap-3">
                <h3 className="cyber-font flex-center-gap pb-2 text-[var(--neon-cyan)]" style={{ fontSize: '13px', fontWeight: 800, borderBottom: '1px solid rgba(0,240,255,0.1)' }}>
                  <Info className="w-4 h-4" />
                  تعليمات الاستخدام
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  تأكد من تشغيل الكاميرا في تبويب <span className="text-[var(--neon-cyan)] font-bold">'المراقبة الحية'</span> لتفعيل التحليل البيومتري للأشخاص ورصد الانتهاكات في الخلفية.
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(143, 160, 181, 0.8)', fontStyle: 'italic', marginTop: '6px' }}>
                  تقوم لعبة محاكاة المشاعر بمطابقة إحداثيات ملامح وجهك وعضلات العينين والفم مع النماذج العصبية للرصد.
                </p>
              </div>
            </div>
            <div className="flex-col gap-4">
              <FaceAnalyzerGame faceAnalyses={faceAnalyses} gameState={gameState} wsUrl={wsUrl} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="glass-panel text-center cyber-font" style={{ margin: '8px', padding: '12px', fontSize: '10px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        © 2026 مختبرات لايرنغ التقنية. جميع الاتصالات العصبية مؤمنة ومحمية.
      </footer>
    </div>
  );
}

export default App;
