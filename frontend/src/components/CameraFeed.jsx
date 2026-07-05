import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, AlertTriangle } from 'lucide-react';

const CameraFeed = ({ onMetadataReceived, wsUrl = "ws://localhost:8000/ws" }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fps, setFps] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const fpsIntervalRef = useRef(1000 / 12);
  const frameCountRef = useRef(0);
  const fpsTimeRef = useRef(0);

  const [processedImgSrc, setProcessedImgSrc] = useState(null);

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;

    return () => {
      stopCamera();
    };
  }, []);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    console.log("Connecting to WebSocket: ", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setErrorMsg("");
      console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      try {
        const data = jsonParseSafely(event.data);
        if (!data) return;

        if (data.type === "frame_data") {
          setProcessedImgSrc(data.image);
          onMetadataReceived(data);
          
          frameCountRef.current++;
          const now = performance.now();
          if (now - fpsTimeRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            fpsTimeRef.current = now;
          }
        } else if (data.type === "game_update") {
          onMetadataReceived({ game: data.game });
        }
      } catch (err) {
        console.error("Error reading WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket connection closed");
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setErrorMsg("خادم الخلفية (Python Backend) لا يستجيب. تأكد من تشغيل ملف backend/server.py");
    };
  };

  const jsonParseSafely = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  };

  const startCamera = async () => {
    try {
      setErrorMsg("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { max: 15 } },
        audio: false
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setIsActive(true);
      connectWebSocket();
      lastFrameTimeRef.current = performance.now();
      fpsTimeRef.current = performance.now();
      frameCountRef.current = 0;
      
      requestRef.current = requestAnimationFrame(processLoop);
    } catch (err) {
      console.error("Failed to access camera:", err);
      setErrorMsg("تم رفض الوصول إلى كاميرا الويب. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.");
    }
  };

  const stopCamera = () => {
    setIsActive(false);
    setProcessedImgSrc(null);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setFps(0);
  };

  const processLoop = (timestamp) => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current) {
      requestRef.current = requestAnimationFrame(processLoop);
      return;
    }

    const elapsed = timestamp - lastFrameTimeRef.current;

    if (elapsed >= fpsIntervalRef.current) {
      lastFrameTimeRef.current = timestamp - (elapsed % fpsIntervalRef.current);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Img = canvas.toDataURL('image/jpeg', 0.6);
        
        if (wsRef.current.readyState === WebSocket.OPEN) {
          const payload = {
            action: "process_frame",
            image: base64Img
          };
          wsRef.current.send(JSON.stringify(payload));
        }
      }
    }

    requestRef.current = requestAnimationFrame(processLoop);
  };

  const sendGameAction = (action, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...payload }));
    }
  };

  window.sendGameActionToWs = sendGameAction;

  return (
    <div className="glass-panel flex-col gap-4 relative overflow-hidden" style={{ minHeight: '400px' }}>
      <div className="flex-between mb-2 pb-3" style={{ borderBottom: '1px solid rgba(0, 240, 255, 0.1)' }}>
        <h2 className="cyber-font flex-center-gap text-cyan-400" style={{ fontSize: '1.1rem', fontWeight: 800 }}>
          <Camera className="w-5 h-5 text-[var(--neon-cyan)] animate-pulse" />
          البث المباشر للكاميرا
        </h2>
        <div className="flex-center-gap">
          {isActive && (
            <span className="text-xs text-[var(--text-secondary)] cyber-font">
              معدل الإطارات: <span className="text-[var(--neon-cyan)] font-bold">{fps}</span>
            </span>
          )}
          <span className="status-badge cyber-font" style={{
            backgroundColor: isConnected ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255, 0, 60, 0.1)',
            color: isConnected ? 'var(--neon-cyan)' : 'var(--neon-red)',
            border: '1px solid',
            borderColor: isConnected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 0, 60, 0.2)',
          }}>
            <span className="w-2 h-2 rounded-full" style={{
              backgroundColor: isConnected ? 'var(--neon-cyan)' : 'var(--neon-red)',
              animation: isConnected ? 'pulse-cyan 1.5s infinite' : 'none'
            }} />
            {isConnected ? 'متصل' : 'غير متصل'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="alert-box mb-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ marginTop: '2px' }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Video stream rendering */}
      <div className="video-container">
        <video 
          ref={videoRef} 
          style={{ display: 'none' }} 
          autoPlay 
          playsInline
        />

        {processedImgSrc ? (
          <img 
            src={processedImgSrc} 
            alt="AI Processed Stream" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="flex-col flex-center gap-3 text-center p-3" style={{ color: 'var(--text-secondary)' }}>
            <CameraOff className="w-12 h-12 stroke-1 opacity-50 mb-2" />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>محرك المعالجة البيومترية غير نشط.</p>
            <p style={{ fontSize: '11px', maxWidth: '320px', opacity: 0.7 }}>يرجى تفعيل بث الكاميرا من الزر في الأسفل لتشغيل المعالجة والتحليل الذاتي للغرفة في الوقت الفعلي.</p>
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-2" style={{ justifyContent: 'center' }}>
        {!isActive ? (
          <button 
            onClick={startCamera} 
            className="cyber-btn"
          >
            <Camera className="w-4 h-4" />
            تشغيل الكاميرا
          </button>
        ) : (
          <button 
            onClick={stopCamera} 
            className="cyber-btn cyber-btn-magenta"
          >
            <CameraOff className="w-4 h-4" />
            إيقاف الكاميرا
          </button>
        )}
        
        {isActive && !isConnected && (
          <button 
            onClick={connectWebSocket} 
            className="cyber-btn"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة الاتصال
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraFeed;
