import React, { useEffect, useRef } from 'react';
import { Users, Shield, ShieldAlert, Package, Clock, Zap } from 'lucide-react';

const DashboardStats = ({ peopleCount, objects, alerts, logs }) => {
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const hasAggression = alerts && alerts.some(a => a.type === "aggression");
  const hasContact = alerts && alerts.some(a => a.type === "contact");

  let securityStatus = "آمن ومستقر";
  let statusClass = "text-cyan-400 border border-cyan-500/20 bg-cyan-500/5";
  let badgeClass = "pulse-badge-secure";

  if (hasAggression) {
    securityStatus = "تم رصد عنف!";
    statusClass = "text-red-500 border border-red-500/20 bg-red-500/5 animate-pulse";
    badgeClass = "pulse-badge-alert";
  } else if (hasContact) {
    securityStatus = "تلامس جسدي";
    statusClass = "text-amber-500 border border-amber-500/20 bg-amber-500/5";
    badgeClass = "pulse-badge-alert bg-amber-500";
  }

  const translateTagName = (name) => {
    const dict = {
      'person': 'شخص',
      'ruler': 'مسطرة',
      'lighter': 'ولاعة',
      'cell phone': 'هاتف محمول',
      'bottle': 'زجاجة',
      'cup': 'كوب',
      'pen': 'قلم',
      'scissors': 'مقص',
      'book': 'كتاب',
      'knife': 'سكين/سلاح أبيض',
      'gun': 'سلاح ناري',
      'pistol': 'مسدس',
      'fire': 'نيران/حريق',
      'smoke': 'دخان',
      'hammer': 'مطرقة/شاكوش',
      'screwdriver': 'مفك براغي',
      'baseball bat': 'مضرب بيسبول'
    };
    return dict[name.toLowerCase()] || name;
  };

  return (
    <div className="flex-col gap-6" style={{ height: '100%', minWidth: '280px' }} dir="rtl">
      {/* Metrics Row */}
      <div className="grid-cols-2" style={{ marginBottom: '16px' }}>
        {/* People counter */}
        <div className="glass-panel flex gap-4 relative overflow-hidden group" style={{ alignItems: 'center' }}>
          <div className="stat-icon">
            <Users className="w-6 h-6" />
          </div>
          <div className="flex-col">
            <div className="cyber-font" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>الحضور بالغرفة</div>
            <div className="cyber-font text-transparent bg-clip-text bg-gradient-to-r from-[var(--neon-cyan)] to-blue-400" style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px' }}>
              {peopleCount} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>{peopleCount === 1 ? 'شخص' : 'أشخاص'}</span>
            </div>
          </div>
          {/* Positional shift for RTL layout */}
          <div className="absolute" style={{ left: 0, bottom: 0, width: '96px', height: '96px', backgroundImage: 'radial-gradient(circle, rgba(0,240,255,0.05) 0%, transparent 70%)', borderRadius: '50%', marginLeft: '-32px', marginBottom: '-32px' }} />
        </div>

        {/* Security badge */}
        <div className="glass-panel flex gap-4 relative overflow-hidden group" style={{ alignItems: 'center' }}>
          <div className="stat-icon" style={{
            backgroundColor: hasAggression ? 'rgba(255, 0, 60, 0.08)' : 'rgba(0, 240, 255, 0.08)',
            borderColor: hasAggression ? 'rgba(255, 0, 60, 0.15)' : 'rgba(0, 240, 255, 0.15)',
            color: hasAggression ? 'var(--neon-red)' : 'var(--neon-cyan)'
          }}>
            {hasAggression ? <ShieldAlert className="w-6 h-6 animate-bounce" /> : <Shield className="w-6 h-6" />}
          </div>
          <div className="flex-col">
            <div className="cyber-font" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>حالة الأمان</div>
            <div className={`status-badge cyber-font ${statusClass}`} style={{ marginTop: '8px', border: '1px solid' }}>
              <span className={badgeClass} />
              {securityStatus}
            </div>
          </div>
          <div className="absolute" style={{ left: 0, bottom: 0, width: '96px', height: '96px', backgroundImage: 'radial-gradient(circle, rgba(255,0,60,0.05) 0%, transparent 70%)', borderRadius: '50%', marginLeft: '-32px', marginBottom: '-32px', display: hasAggression ? 'block' : 'none' }} />
        </div>
      </div>

      {/* Object detection card */}
      <div className="glass-panel flex-col gap-4" style={{ flex: 1, marginBottom: '16px' }}>
        <h3 className="cyber-font flex-center-gap pb-2 text-[var(--neon-cyan)]" style={{ fontSize: '13px', fontWeight: 800, borderBottom: '1px solid rgba(0, 240, 255, 0.1)' }}>
          <Package className="w-4 h-4" />
          الأدوات والمواد المكتشفة في الكاميرا
        </h3>
        
        {objects.length === 0 ? (
          <div className="flex-1 flex-center" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '24px 0' }}>
            لم يتم رصد أي أدوات حالياً في الغرفة.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" style={{ padding: '8px 0' }}>
            {objects.map((obj, idx) => {
              const isFlagged = ["lighter", "scissors", "knife", "gun", "pistol", "fire", "smoke", "hammer", "screwdriver", "baseball bat"].includes(obj.toLowerCase());
              return (
                <span 
                  key={idx} 
                  className="cyber-font"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: isFlagged ? 'rgba(255, 153, 0, 0.1)' : 'rgba(57, 255, 20, 0.1)',
                    color: isFlagged ? 'var(--neon-orange)' : 'var(--neon-green)',
                    border: '1px solid',
                    borderColor: isFlagged ? 'rgba(255, 153, 0, 0.2)' : 'rgba(57, 255, 20, 0.2)',
                    animation: isFlagged ? 'pulse-cyan 2s infinite' : 'none'
                  }}
                >
                  <Zap className="w-3 h-3" />
                  {translateTagName(obj).toUpperCase()}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Real-time system logs */}
      <div className="glass-panel flex-col gap-3" style={{ height: '280px' }}>
        <h3 className="cyber-font flex-center-gap pb-2 text-[var(--neon-cyan)]" style={{ fontSize: '13px', fontWeight: 800, borderBottom: '1px solid rgba(0, 240, 255, 0.1)' }}>
          <Clock className="w-4 h-4" />
          سجل الأحداث والتشخيص المباشر
        </h3>
        
        <div ref={logContainerRef} className="flex-1" style={{ overflowY: 'auto', paddingLeft: '4px', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', fontSize: '11px', textAlign: 'right' }}>
          {logs.length === 0 ? (
            <div className="flex-1 flex-center" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              بانتظار البيانات... قم بتشغيل الكاميرا لبدء عرض الأحداث.
            </div>
          ) : (
            logs.map((log, index) => {
              const isAgg = log.text.includes("ضرب") || log.text.includes("عنف");
              const isContact = log.text.includes("تلامس جسدي") || log.text.includes("يلمس");
              const isObj = log.text.includes("رصد أداة") || log.text.includes("ولاعة") || log.text.includes("مسطرة");
              
              let logColor = "text-[var(--text-secondary)]";
              if (isAgg) logColor = "text-[var(--neon-red)] font-semibold";
              else if (isContact) logColor = "text-amber-400";
              else if (isObj) logColor = "text-[var(--neon-cyan)]";

              return (
                <div key={index} className="p-2 animate-fade-in" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontFamily: 'sans-serif' }}>{log.time}</span>
                  <span className={logColor}>{log.text}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
