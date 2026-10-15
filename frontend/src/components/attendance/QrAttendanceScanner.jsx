import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode,
  Camera,
  CameraOff,
  SwitchCamera,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Search,
  Sparkles,
  Zap,
  RefreshCw,
  Flashlight,
  FlashlightOff,
  Users,
  Check,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Send,
  Upload,
  Info,
} from 'lucide-react';

export default function QrAttendanceScanner({ schoolCode }) {
  const { schoolProfile, schoolName } = useAuth();

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);

  // Last Scanned Result & Feedback
  const [lastScannedStudent, setLastScannedStudent] = useState(null);
  const [scanStatus, setScanStatus] = useState(null); // 'success', 'already_marked', 'error', 'loading'
  const [statusMessage, setStatusMessage] = useState('');

  // Today's Live Attendance Feed
  const [todayPresents, setTodayPresents] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScannedPayloadRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  const isProcessingRef = useRef(false);

  // 1. Play Success Audio Chime via Web Audio API
  const playSuccessChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // High crisp dual chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6
      gain2.gain.setValueAtTime(0.3, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio chime play error:', e);
    }
  };

  // Play Warning / Duplicate Sound
  const playWarningBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Warning beep error:', e);
    }
  };

  // 2. Speech Synthesis voice announcement: "Attendance marked!"
  const speakAnnouncement = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // 3. Physical Device Vibration (Mobile)
  const triggerVibration = (pattern = [150, 70, 150]) => {
    if (!vibrateEnabled || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration error:', e);
    }
  };

  // 4. Fetch Today's Live Attendance Scanned List
  const fetchTodayFeed = async () => {
    setFeedLoading(true);
    try {
      const res = await api.get('/attendance/qr-today', {
        params: { schoolCode },
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setTodayPresents(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch today QR attendance feed:', err);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (schoolCode) fetchTodayFeed();
  }, [schoolCode]);

  // 5. Detect and initialize available video cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment / rear back camera on mobile devices
          const rearCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(rearCam ? rearCam.id : devices[0].id);
        } else {
          setCameraError('No camera found on this device. Please connect a webcam.');
        }
      })
      .catch((err) => {
        console.error('Camera detection error:', err);
        setCameraError('Camera permission denied or camera unavailable. Please allow access.');
      });

    return () => {
      stopScanner();
    };
  }, []);

  // 6. Start the Camera Scanner with Native BarcodeDetector & Dynamic Frame
  const startScanner = async (cameraIdToUse) => {
    const targetCameraId = cameraIdToUse || selectedCameraId;
    if (!targetCameraId) return;

    setCameraError(null);
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      // Initialize scanner with native hardware-accelerated C++ BarcodeDetector engine
      // Delivers sub-50ms instant detection in Chromium/Edge and auto-falls back to ZXing in other browsers
      const html5QrCode = new Html5Qrcode('qr-reader-container', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Native C++ hardware acceleration in Chrome/Edge!
        },
      });
      html5QrCodeRef.current = html5QrCode;

      // 20 FPS + focused bounding box matching green reticle brackets
      // Reduces pixel processing surface by 80% for instant millisecond decoding
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.max(240, Math.floor(minEdge * 0.8));
          return {
            width: edge,
            height: edge,
          };
        },
        disableFlip: false,
      };

      await html5QrCode.start(
        targetCameraId,
        config,
        (decodedText) => {
          handleQrCodeScanned(decodedText);
        },
        () => {
          // Frame pass
        }
      );

      setIsScanning(true);

      // Check for torch/flashlight capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.error('Failed to start QR camera:', err);
      setCameraError('Could not start camera feed: ' + (err.message || 'Permission denied'));
      setIsScanning(false);
    }
  };

  // Stop the Camera Scanner
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
    }
    setIsScanning(false);
    setTorchOn(false);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Switch camera dropdown
  const handleCameraChange = async (e) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (isScanning) {
      await stopScanner();
      startScanner(newId);
    }
  };

  // Quick 1-tap flip camera (Front/Back) for mobile phones
  const handleFlipCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    setSelectedCameraId(nextCameraId);
    if (isScanning) {
      await stopScanner();
      startScanner(nextCameraId);
    }
  };

  // 7. Handle QR Code Detection & Backend Attendance Marking
  const handleQrCodeScanned = async (qrPayload) => {
    if (!qrPayload || isProcessingRef.current) return;

    const now = Date.now();
    // 2-second cooldown for the exact same QR payload to prevent rapid bursts
    if (
      qrPayload === lastScannedPayloadRef.current &&
      now - lastScannedTimeRef.current < 2000
    ) {
      return;
    }

    lastScannedPayloadRef.current = qrPayload;
    lastScannedTimeRef.current = now;
    isProcessingRef.current = true;

    setScanStatus('loading');
    setStatusMessage('Marking attendance in official school register...');

    try {
      const scanDateObj = new Date();
      const clientTimeIn = scanDateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const clientDateStr =
        scanDateObj.getFullYear() +
        '-' +
        String(scanDateObj.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(scanDateObj.getDate()).padStart(2, '0');

      const res = await api.post('/attendance/qr-scan', {
        schoolCode,
        qrPayload,
        timeIn: clientTimeIn,
        clientDate: clientDateStr,
      });

      if (res.data.success && res.data.data) {
        const student = res.data.data;
        setLastScannedStudent(student);

        if (res.data.alreadyMarked) {
          // Already marked earlier today
          setScanStatus('already_marked');
          setStatusMessage(
            `${student.fullName} is already marked PRESENT today at ${student.timeIn || 'earlier'}!`
          );
          playWarningBeep();
          triggerVibration([100, 50, 100]);
          speakAnnouncement(`Already marked! ${student.fullName}`);
        } else {
          // Newly marked PRESENT
          setScanStatus('success');
          setStatusMessage(
            `Attendance marked successfully for ${student.fullName} at ${student.timeIn}!`
          );
          playSuccessChime();
          triggerVibration([200, 100, 200]);
          speakAnnouncement(`Attendance marked! ${student.fullName}`);

          // Add to live feed top
          setTodayPresents((prev) => [
            {
              studentId: student.studentId,
              fullName: student.fullName,
              fatherName: student.fatherName,
              rollNumber: student.rollNumber,
              admissionNumber: student.admissionNumber,
              className: student.className,
              section: student.section,
              photo: student.photo,
              status: 'PRESENT',
              timeIn: student.timeIn,
              remarks: 'Digital QR Gate Scan',
            },
            ...prev.filter((p) => String(p.studentId) !== String(student.studentId)),
          ]);
        }
      } else {
        setScanStatus('error');
        setStatusMessage(res.data.message || 'Student record could not be found.');
        playWarningBeep();
      }
    } catch (err) {
      console.error('QR attendance marking error:', err);
      setScanStatus('error');
      setStatusMessage(
        err.response?.data?.message || 'Invalid QR code or student not enrolled in this school.'
      );
      playWarningBeep();
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 600);
    }
  };

  // 8. Handle Image File Scan (Upload Card Screenshot or Photo)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanStatus('loading');
      setStatusMessage('Scanning QR image file...');

      // Use dedicated hidden element so it never clashes with active camera scanner
      let anchor = document.getElementById('qr-file-scan-temp');
      if (!anchor) {
        anchor = document.createElement('div');
        anchor.id = 'qr-file-scan-temp';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
      }

      const tempScanner = new Html5Qrcode('qr-file-scan-temp', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      const decodedText = await tempScanner.scanFile(file, false);
      try {
        await tempScanner.clear();
      } catch {}

      handleQrCodeScanned(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setScanStatus('error');
      setStatusMessage('Could not read QR code from this image. Please ensure the QR is clear and well-lit.');
      playWarningBeep();
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // 9. Manual Fallback Search / Roll Number Input
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setManualSubmitting(true);
    handleQrCodeScanned(manualInput.trim()).finally(() => {
      setManualSubmitting(false);
      setManualInput('');
    });
  };

  const filteredPresents = todayPresents.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.fullName?.toLowerCase().includes(q) ||
      item.rollNumber?.toLowerCase().includes(q) ||
      item.admissionNumber?.toLowerCase().includes(q) ||
      item.className?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-5 pb-16">
      {/* Viewfinder CSS Injection */}
      <style>{`
        #qr-reader-container video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }
        #qr-reader-container {
          border: none !important;
        }
        #qr-reader-container__scan_region {
          background: transparent !important;
        }
      `}</style>

      {/* 1. TOP HEADER BANNER */}
      <div className="bg-[#041633] text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#ffa000] text-xs font-bold uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            <span>Attendance Center • Automated Digital Gate Pass</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span>QR Attendance Gate Scanner</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Scanner Engine
            </span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Scan student identity cards via mobile camera or laptop webcam for instant gate attendance.
            Features audio chimes, voice confirmation, and device vibration.
          </p>
        </div>

        {/* Live Counters Banner */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-xl text-center">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Scanned Today
            </span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {todayPresents.length}
            </span>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-xl text-center">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Status
            </span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1 mt-1 justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Gate Ready</span>
            </span>
          </div>
        </div>
      </div>

      {/* Optical Scanning Tips Alert Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 text-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Scanning Tip:</strong> Agar mobile screen se scan kar rahay hain to mobile ki screen brightness full karain aur camera se <strong>6-10 inches door</strong> rakhain taa k webcam focus kar sakay.
          </span>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-400 hover:bg-amber-500 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload QR Image</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* 2. SCANNER CONTROLS & CAMERA INTERACTION PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left / Main Column: Live Viewfinder & Scanner Container */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          {/* Hardware & Settings Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 text-xs">
            {/* Camera Select Dropdown & Flip Button */}
            <div className="flex items-center gap-1.5 min-w-[200px]">
              <Camera className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={selectedCameraId}
                onChange={handleCameraChange}
                disabled={cameras.length === 0}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 cursor-pointer truncate"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>

              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition shrink-0 border border-slate-200"
                  title="Flip Front / Rear Camera"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              )}
            </div>

            {/* Audio, Speech & Vibration Toggles */}
            <div className="flex items-center gap-2">
              {/* Torch button (on supported mobile devices) */}
              {hasTorch && isScanning && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition ${
                    torchOn
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Toggle Flashlight / Torch"
                >
                  {torchOn ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5" />}
                  <span>Torch</span>
                </button>
              )}

              {/* Sound Chime Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition ${
                  soundEnabled
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
                title="Sound Chime On/Off"
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>Chime</span>
              </button>

              {/* Voice Prompt Toggle */}
              <button
                type="button"
                onClick={() => setVoiceEnabled((prev) => !prev)}
                className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition ${
                  voiceEnabled
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
                title="Voice Announcement On/Off"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Voice</span>
              </button>

              {/* Vibration Toggle */}
              <button
                type="button"
                onClick={() => setVibrateEnabled((prev) => !prev)}
                className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition ${
                  vibrateEnabled
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
                title="Vibrate Mobile On/Off"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Vibrate</span>
              </button>
            </div>
          </div>

          {/* Camera Viewfinder Container */}
          <div className="relative rounded-2xl bg-slate-950 overflow-hidden shadow-inner flex flex-col items-center justify-center min-h-[380px] sm:min-h-[420px]">
            {/* HTML5 QR Code Video Anchor */}
            <div id="qr-reader-container" className="w-full h-full max-w-[500px]"></div>

            {/* Idle Overlay when camera is stopped */}
            {!isScanning && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-6 text-white space-y-3 z-10">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shadow-xl">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Camera Scanner Ready</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Click "Launch Camera Scanner" below to activate mobile camera or laptop webcam for QR scanning.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>Launch Camera Scanner</span>
                </button>
              </div>
            )}

            {/* Error Message Overlay */}
            {cameraError && (
              <div className="absolute top-4 inset-x-4 z-20 bg-rose-900/90 text-white border border-rose-700/80 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xl">
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Viewfinder Target Box with Animated Green Laser Scanner Effect */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Target Frame Box with Glowing Neon Emerald Corners */}
                <div className="relative w-[270px] h-[270px] sm:w-[310px] sm:h-[310px] rounded-2xl overflow-hidden">
                  {/* Glowing 4 Neon Emerald Corner Brackets */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-[0_0_14px_#10b981]"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-[0_0_14px_#10b981]"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-[0_0_14px_#10b981]"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-[0_0_14px_#10b981]"></div>

                  {/* Subtle Center Reticle Crosshair */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border border-emerald-400/25 rounded-full pointer-events-none"></div>

                  {/* Dynamic Glowing Green Laser Beam Sweeping Top-to-Bottom */}
                  <div className="absolute inset-x-0 animate-laser-sweep pointer-events-none z-10 flex flex-col items-center">
                    {/* Upward Glowing Light Trail */}
                    <div className="w-full h-16 bg-gradient-to-t from-emerald-500/30 to-transparent"></div>
                    {/* High-Intensity Neon Green Laser Beam Line */}
                    <div className="w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#10b981,0_0_8px_#34d399]"></div>
                    {/* Downward Soft Light Reflection */}
                    <div className="w-full h-3 bg-gradient-to-b from-emerald-400/25 to-transparent"></div>
                  </div>
                </div>

                {/* Subtitle helper badge with pulsing green radar beacon */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm border border-emerald-500/50 text-white text-[11px] font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-300">Scanner Active</span>
                  <span className="text-slate-400">•</span>
                  <span>Align Student Card Inside Frame</span>
                </div>
              </div>
            )}
          </div>

          {/* Scanner Bottom Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {isScanning ? (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Pause Scanner</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Resume Scanner</span>
                </button>
              )}

              <button
                type="button"
                onClick={fetchTodayFeed}
                disabled={feedLoading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                title="Refresh Attendance Count"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${feedLoading ? 'animate-spin text-amber-500' : ''}`} />
                <span>Sync</span>
              </button>
            </div>

            {/* Quick Manual Roll # / Admission # Fallback Input */}
            <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Manual Roll # or Adm #..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 w-44"
              />
              <button
                type="submit"
                disabled={manualSubmitting || !manualInput.trim()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {manualSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Mark</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Instant Student Card Verification & Today's Live Feed */}
        <div className="lg:col-span-5 space-y-4">
          {/* A. LAST SCANNED STUDENT BADGE (INSTANT POPUP) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Last Scanned Candidate
                </h3>
              </div>

              {scanStatus && (
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    scanStatus === 'success'
                      ? 'bg-emerald-100 text-emerald-800'
                      : scanStatus === 'already_marked'
                      ? 'bg-amber-100 text-amber-800'
                      : scanStatus === 'loading'
                      ? 'bg-blue-100 text-blue-800 animate-pulse'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {scanStatus === 'success'
                    ? 'Marked Present'
                    : scanStatus === 'already_marked'
                    ? 'Already Present'
                    : scanStatus === 'loading'
                    ? 'Verifying...'
                    : 'Scan Failed'}
                </span>
              )}
            </div>

            {/* Student Verified Card Display */}
            {lastScannedStudent ? (
              <div
                className={`p-4 rounded-xl border transition-all ${
                  scanStatus === 'success'
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : scanStatus === 'already_marked'
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Photo Frame */}
                  <div className="relative w-16 h-18 rounded-xl bg-white p-0.5 shadow-sm border border-slate-200 overflow-hidden shrink-0">
                    {lastScannedStudent.photo ? (
                      <img
                        src={lastScannedStudent.photo}
                        alt={lastScannedStudent.fullName}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 text-slate-600 font-black text-lg flex items-center justify-center rounded-lg">
                        {lastScannedStudent.fullName ? lastScannedStudent.fullName.charAt(0) : 'S'}
                      </div>
                    )}
                  </div>

                  {/* Candidate Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate uppercase">
                      {lastScannedStudent.fullName}
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      Father: {lastScannedStudent.fatherName ? `Mr. ${lastScannedStudent.fatherName}` : '—'}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="bg-[#881337] text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">
                        {lastScannedStudent.className} ({lastScannedStudent.section || 'A'})
                      </span>
                      <span className="bg-slate-900 text-amber-300 font-mono text-[9px] font-black px-2 py-0.5 rounded">
                        Roll #{lastScannedStudent.rollNumber || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scan Status Message & Time In */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Time In: <strong className="font-mono text-slate-950">{lastScannedStudent.timeIn}</strong></span>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ Verified Gate Pass
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">No student scanned yet.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Point the camera at an ID Card QR Code to mark attendance.
                </p>
              </div>
            )}
          </div>

          {/* B. TODAY'S LIVE STREAM LIST */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Today's Scanned Students Feed
                </h3>
              </div>

              <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {todayPresents.length} Present
              </span>
            </div>

            {/* Quick Search in today's feed */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search today's present students..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Feed Scroll List */}
            <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
              {filteredPresents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                  {todayPresents.length === 0
                    ? 'No QR scans recorded today yet.'
                    : 'No matching students found for this search.'}
                </div>
              ) : (
                filteredPresents.map((p, idx) => (
                  <div
                    key={`${p.studentId}-${idx}`}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                        {p.fullName ? p.fullName.charAt(0) : 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{p.fullName}</div>
                        <div className="text-[10px] text-slate-500">
                          Roll #{p.rollNumber || '—'} • {p.className} ({p.section || 'A'})
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 text-[10px]">
                        {p.timeIn || 'PRESENT'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
