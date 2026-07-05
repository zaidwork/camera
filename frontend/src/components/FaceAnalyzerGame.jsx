import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Gamepad2, Play, Square, User, Eye, Smile, Calendar } from 'lucide-react';

const FaceAnalyzerGame = ({ faceAnalyses, gameState, wsUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetEmotion, setTargetEmotion] = useState("Happy");

  // Supabase states
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [lastGameScore, setLastGameScore] = useState(null);

  const emotionEmojis = {
    "Neutral": "😐",
    "Happy": "😄",
    "Sad": "😢",
    "Surprise": "😲",
    "Angry": "😡",
    "Fear": "😨",
    "Disgust": "🤢",
    "Contempt": "😒"
  };

  const eyeColorHex = {
    "Blue": "#00d2ff",
    "Green": "#39ff14",
    "Brown": "#b07d62",
    "Hazel": "#c2a649",
    "Grey": "#a0aab2",
    "Unknown": "#ffffff"
  };

  const translateGender = (g) => {
    return g === "Male" ? "ذكر" : g === "Female" ? "أنثى" : g;
  };

  const translateEmotion = (e) => {
    const dict = {
      "Neutral": "طبيعي / حيادي",
      "Happy": "سعيد",
      "Sad": "حزين",
      "Surprise": "متفاجئ",
      "Angry": "غاضب",
      "Fear": "خائف",
      "Disgust": "مشمئز",
      "Contempt": "مستاء"
    };
    return dict[e] || e;
  };

  const translateFaceShape = (s) => {
    const dict = {
      "Oval": "بيضوي",
      "Round": "دائري",
      "Square": "مربع",
      "Heart": "قلبي",
      "Oblong": "مستطيل / ممدود",
      "Unknown": "غير معروف"
    };
    return dict[s] || s;
  };

  const translateEyeColor = (c) => {
    const dict = {
      "Blue": "أزرق",
      "Green": "أخضر",
      "Brown": "بني",
      "Hazel": "عسلي",
      "Grey": "رمادي",
      "Unknown": "غير معروف"
    };
    return dict[c] || c;
  };

  const translateFeedback = (fb) => {
    if (!fb) return "";
    let res = fb;
    res = res.replace(/Mimic: (\w+)!/, 'قم بمحاكاة: $1!');
    res = res.replace(/Correct! Now make: (\w+)!/, 'صحيح! والآن قم بمحاكاة: $1!');
    
    // Translate English emotion names to Arabic inside text
    res = res.replace(/Happy/g, 'سعيد');
    res = res.replace(/Sad/g, 'حزين');
    res = res.replace(/Surprise/g, 'متفاجئ');
    res = res.replace(/Angry/g, 'غاضب');
    res = res.replace(/Neutral/g, 'طبيعي');
    res = res.replace(/Fear/g, 'خائف');
    res = res.replace(/Disgust/g, 'مشمئز');
    res = res.replace(/Contempt/g, 'مستاء');
    return res;
  };

  // Fetch leaderboard scores from backend API
  const fetchLeaderboard = () => {
    if (!wsUrl) return;
    let httpBaseUrl = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
    fetch(`${httpBaseUrl}/api/leaderboard`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLeaderboard(data);
        }
      })
      .catch(err => console.error("Error loading leaderboard:", err));
  };

  useEffect(() => {
    if (wsUrl) {
      fetchLeaderboard();
    }
  }, [showLeaderboard, wsUrl]);

  const handleStartGame = () => {
    setIsPlaying(true);
    setLastGameScore(null);
    if (window.sendGameActionToWs) {
      window.sendGameActionToWs("start_game", { target_emotion: targetEmotion });
    }
  };

  const handleStopGame = () => {
    setIsPlaying(false);
    if (window.sendGameActionToWs) {
      window.sendGameActionToWs("stop_game");
    }
    if (gameState && gameState.score > 0) {
      setLastGameScore(gameState.score);
    }
  };

  const handleEmotionChange = (e) => {
    setTargetEmotion(e.target.value);
    if (isPlaying && window.sendGameActionToWs) {
      window.sendGameActionToWs("start_game", { target_emotion: e.target.value });
    }
  };

  const handleSaveScore = () => {
    if (!playerName.trim() || !lastGameScore || !wsUrl) return;
    setIsSubmittingScore(true);
    let httpBaseUrl = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
    
    fetch(`${httpBaseUrl}/api/leaderboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        player_name: playerName,
        score: lastGameScore,
        high_score: gameState?.high_score || lastGameScore
      })
    })
    .then(res => res.json())
    .then(() => {
      setLastGameScore(null);
      setPlayerName('');
      setIsSubmittingScore(false);
      setShowLeaderboard(true);
      fetchLeaderboard();
    })
    .catch(err => {
      console.error("Error saving score:", err);
      setIsSubmittingScore(false);
    });
  };

  const analysesList = Object.entries(faceAnalyses || {}).map(([pid, analysis]) => ({
    id: pid,
    ...analysis
  }));

  return (
    <div className="grid-md-2" style={{ height: '100%' }} dir="rtl">
      {/* Panel 1: Face Attributes Card */}
      <div className="glass-panel flex-col gap-4">
        <h3 className="cyber-font flex-center-gap pb-2 text-[var(--neon-cyan)]" style={{ fontSize: '13px', fontWeight: 800, borderBottom: '1px solid rgba(0, 240, 255, 0.1)' }}>
          <Sparkles className="w-4 h-4" />
          ماسح الوجه البيومتري
        </h3>

        {analysesList.length === 0 ? (
          <div className="flex-1 flex-col flex-center text-center" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '40px 0', gap: '8px' }}>
            <User className="w-8 h-8 opacity-30 stroke-1" />
            بانتظار رصد وجه في بث الكاميرا...
          </div>
        ) : (
          <div className="flex-1" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {analysesList.map((person) => (
              <div 
                key={person.id} 
                className="animate-fade-in"
                style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(0, 240, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div className="flex-between pb-2" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span className="cyber-font text-cyan-400" style={{ fontSize: '12px', fontWeight: 800 }}>
                    ملف الشخص #{person.id}
                  </span>
                  <span className="cyber-font" style={{ fontSize: '10px', backgroundColor: 'rgba(0, 240, 255, 0.1)', color: 'var(--neon-cyan)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(0, 240, 255, 0.2)', fontWeight: 'bold' }}>
                    نشط
                  </span>
                </div>

                <div className="grid-cols-2 text-xs" style={{ textAlign: 'right' }}>
                  {/* Age & Gender */}
                  <div className="flex" style={{ alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '8px', borderRadius: '4px' }}>
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>العمر / الجنس</div>
                      <div style={{ fontWeight: 600 }}>{translateGender(person.gender)} | فئة {person.age}</div>
                    </div>
                  </div>

                  {/* Emotion */}
                  <div className="flex" style={{ alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '8px', borderRadius: '4px' }}>
                    <Smile className="w-4 h-4 text-[var(--neon-magenta)]" />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>الحالة النفسية</div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{emotionEmojis[person.emotion] || "😐"}</span>
                        <span>{translateEmotion(person.emotion)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Face Shape */}
                  <div className="flex" style={{ alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '8px', borderRadius: '4px' }}>
                    <User className="w-4 h-4 text-[var(--neon-orange)]" />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>شكل الوجه</div>
                      <div style={{ fontWeight: 600 }}>وجه {translateFaceShape(person.face_shape)}</div>
                    </div>
                  </div>

                  {/* Eye Color */}
                  <div className="flex" style={{ alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '8px', borderRadius: '4px' }}>
                    <Eye className="w-4 h-4 text-[var(--neon-green)]" />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>لون العين</div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'inline-block', backgroundColor: eyeColorHex[person.eye_color] || '#fff' }}
                        />
                        <span>{translateEyeColor(person.eye_color)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel 2: Interactive Emotion Game Card */}
      <div className="glass-panel flex-col gap-4 relative overflow-hidden">
        <h3 className="cyber-font flex pb-2 text-[var(--neon-cyan)]" style={{ fontSize: '13px', fontWeight: 800, borderBottom: '1px solid rgba(0, 240, 255, 0.1)', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="flex" style={{ gap: '8px', alignItems: 'center' }}>
            <Gamepad2 className="w-4 h-4" />
            {showLeaderboard ? 'لوحة صدارة المشاعر' : 'مركز لعبة محاكاة المشاعر'}
          </div>
          <button 
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="cyber-btn"
            style={{ padding: '4px 8px', fontSize: '10px', display: 'flex', gap: '4px', alignItems: 'center', minWidth: 'auto', borderRadius: '6px' }}
          >
            {showLeaderboard ? <Gamepad2 className="w-3.5 h-3.5" /> : <Trophy className="w-3.5 h-3.5" />}
            {showLeaderboard ? 'اللعبة' : 'لوحة الصدارة'}
          </button>
        </h3>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', padding: '8px 0' }}>
          {/* Game Scoreboard */}
          <div className="flex-between" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '12px' }}>
            <div className="flex" style={{ alignItems: 'center', gap: '8px' }}>
              <Trophy className="w-4 h-4 text-amber-400" />
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                أعلى نتيجة: <span className="text-[var(--neon-orange)] cyber-font">{gameState?.high_score || 0}</span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              النتيجة الحالية: <span className="text-[var(--neon-cyan)] cyber-font">{gameState?.score || 0}</span>
            </div>
          </div>

          {/* Game Main Area / Leaderboard Area */}
          {showLeaderboard ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.25)', overflowY: 'auto', maxHeight: '250px' }}>
              {leaderboard.length === 0 ? (
                <div className="flex-1 flex-col flex-center text-center py-8 text-xs text-[var(--text-secondary)] italic gap-2" style={{ justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
                  <Trophy className="w-8 h-8 opacity-25 stroke-1" />
                  لا يوجد نتائج مسجلة بعد. كن أول من يسجل نتيجة!
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '6px', textAlign: 'center' }}>الترتيب</th>
                      <th style={{ padding: '6px' }}>اللاعب</th>
                      <th style={{ padding: '6px', textAlign: 'center' }}>النقاط</th>
                      <th style={{ padding: '6px', textAlign: 'center' }}>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, idx) => (
                      <tr key={row.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#fff' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', color: idx === 0 ? 'var(--neon-orange)' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : '#888' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '8px 6px' }}>{row.player_name}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--neon-cyan)', fontFamily: 'monospace', fontWeight: 'bold' }}>{row.score}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {new Date(row.created_at).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : lastGameScore ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1px solid var(--neon-cyan)', borderRadius: '12px', backgroundColor: 'rgba(0, 240, 255, 0.05)', gap: '12px' }} className="animate-fade-in">
              <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
              <h4 className="cyber-font text-white" style={{ fontSize: '14px', fontWeight: 800 }}>انتهت اللعبة! نتيجتك: {lastGameScore} نقطة</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>أدخل اسمك لحفظ النتيجة في لوحة الصدارة العالمية:</p>
              <div className="flex gap-2 w-full" style={{ maxWidth: '280px' }}>
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="cyber-font"
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    border: '1px solid var(--neon-cyan)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    textAlign: 'center'
                  }}
                  placeholder="الاسم"
                  maxLength={15}
                  disabled={isSubmittingScore}
                />
                <button 
                  onClick={handleSaveScore} 
                  className="cyber-btn"
                  style={{ fontSize: '12px', padding: '6px 12px', minWidth: 'auto' }}
                  disabled={isSubmittingScore || !playerName.trim()}
                >
                  {isSubmittingScore ? 'جاري...' : 'حفظ'}
                </button>
              </div>
              <button 
                onClick={() => setLastGameScore(null)} 
                style={{ fontSize: '10px', color: 'var(--text-secondary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                تخطي
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '12px', position: 'relative', backgroundColor: 'rgba(0, 0, 0, 0.25)' }}>
              {isPlaying ? (
                <div className="flex-col flex-center text-center gap-3 animate-fade-in">
                  <div style={{ fontSize: '60px', animation: 'bounce 1s infinite', marginBottom: '4px' }}>
                    {emotionEmojis[gameState?.target_emotion] || "😐"}
                  </div>
                  <h4 className="cyber-font" style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                    حاكي تعبير: <span className="text-[var(--neon-cyan)]">{translateEmotion(gameState?.target_emotion)?.toUpperCase()}</span>
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px', marginTop: '4px' }}>
                    {translateFeedback(gameState?.feedback) || "انظر إلى الكاميرا وقم بمطابقة الملامح المطلوبة!"}
                  </p>
                </div>
              ) : (
                <div className="flex-col flex-center text-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Gamepad2 className="w-12 h-12 stroke-1 opacity-40 mb-2" />
                  <p style={{ fontSize: '12px', fontWeight: 600 }}>اختبر الوجوه والتعبيرات الذاتية!</p>
                  <p style={{ fontSize: '10px', opacity: 0.75, maxWidth: '220px' }}>
                    اختر شعوراً بدائياً وابدأ اللعبة. سيقوم نموذج الذكاء الاصطناعي بتحليل ومطابقة دقة ملامح وجهك وقياسها في الوقت المباشر.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex-col gap-3">
            {!isPlaying && !lastGameScore && (
              <div className="flex-between" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>الشعور البدائي:</span>
                <select 
                  value={targetEmotion} 
                  onChange={handleEmotionChange}
                  className="bg-black/80 border border-cyan-500/30 text-cyan-400 rounded px-2.5 py-1 text-xs outline-none cyber-font cursor-pointer"
                >
                  <option value="Happy">سعيد 😄</option>
                  <option value="Sad">حزين 😢</option>
                  <option value="Surprise">متفاجئ 😲</option>
                  <option value="Angry">غاضب 😡</option>
                  <option value="Neutral">حيادي 😐</option>
                </select>
              </div>
            )}

            {!lastGameScore && (
              <div className="flex gap-4" style={{ justifyContent: 'center' }}>
                {!isPlaying ? (
                  <button 
                    onClick={handleStartGame} 
                    className="cyber-btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Play className="w-4 h-4 fill-current" style={{ marginLeft: '8px' }} />
                    ابدأ اللعبة
                  </button>
                ) : (
                  <button 
                    onClick={handleStopGame} 
                    className="cyber-btn cyber-btn-magenta"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Square className="w-4 h-4 fill-current" style={{ marginLeft: '8px' }} />
                    إنهاء اللعبة
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceAnalyzerGame;
