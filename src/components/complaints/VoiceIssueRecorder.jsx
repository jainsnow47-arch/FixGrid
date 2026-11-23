import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Mic, MicOff, Sparkles, Square, Volume2 } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../ui/Button.jsx';
import { FG_EASE } from '../ui/MotionPrimitives.jsx';

const SPEECH_LANGS = [
  { value: 'en-IN', label: 'English (IN)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'hi-IN', label: 'Hindi' },
];

function getSupportedAudioMime() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || '';
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function VoiceIssueRecorder({ address, ward, position, onExtracted }) {
  const { showToast } = useToast();

  const [speechSupported] = useState(
    () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [micSupported] = useState(
    () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  );

  const [lang, setLang] = useState('en-IN');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [bars, setBars] = useState(() => Array(12).fill(0.15));
  const [inlineError, setInlineError] = useState('');

  const isRecordingRef = useRef(false);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const finalTextRef = useRef('');
  const interimTextRef = useRef('');

  const cleanupMedia = () => {
    isRecordingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore already stopped recognition
      }
      recognitionRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setBars(Array(12).fill(0.15));
  };

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, []);

  const startRecording = async () => {
    setInlineError('');
    if (!micSupported && !speechSupported) {
      setInlineError('Voice input is not supported in this browser. Please type your issue below.');
      return;
    }

    finalTextRef.current = '';
    interimTextRef.current = '';
    chunksRef.current = [];
    setFinalTranscript('');
    setInterimTranscript('');
    setElapsedSec(0);

    try {
      if (micSupported) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;

        // Live audio stream waveform metering
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);

          const tickMeter = () => {
            if (!isRecordingRef.current) return;
            analyser.getByteFrequencyData(data);
            const nextBars = Array.from({ length: 12 }, (_, idx) => {
              const val = data[idx + 1] || 0;
              return Math.max(0.14, Math.min(1, val / 180));
            });
            setBars(nextBars);
            rafRef.current = requestAnimationFrame(tickMeter);
          };
          rafRef.current = requestAnimationFrame(tickMeter);
        }

        // Capture compressed audio stream for server-side AI processing
        if (window.MediaRecorder) {
          const mimeType = getSupportedAudioMime();
          const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
          recorderRef.current = recorder;
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              chunksRef.current.push(ev.data);
            }
          };
          recorder.start(250);
        }
      }

      // Start Web Speech API live speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onresult = (event) => {
          let finalized = finalTextRef.current;
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const phrase = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalized = `${finalized} ${phrase}`.trim();
            } else {
              interim = `${interim} ${phrase}`.trim();
            }
          }
          finalTextRef.current = finalized;
          interimTextRef.current = interim;
          setFinalTranscript(finalized);
          setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setInlineError('Microphone speech permission was denied. Check browser site permissions.');
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {
              // Ignore restart race when user stops
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      isRecordingRef.current = true;
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } catch (err) {
      cleanupMedia();
      setRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setInlineError('Microphone access was blocked. Allow microphone access in your browser to use voice reporting.');
      } else {
        setInlineError(err.message || 'Could not access your microphone.');
      }
    }
  };

  const stopRecorderAndGetBlob = () => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      const mimeType = recorder.mimeType || 'audio/webm';
      recorder.onstop = () => {
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: mimeType }) : null;
        recorderRef.current = null;
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        recorderRef.current = null;
        resolve(null);
      }
    });
  };

  const handleStopAndExtract = async () => {
    isRecordingRef.current = false;
    setRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop race
      }
    }

    const audioBlob = await stopRecorderAndGetBlob();
    cleanupMedia();

    const combinedTranscript = [finalTextRef.current, interimTextRef.current]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (combinedTranscript.length < 3 && (!audioBlob || audioBlob.size < 400)) {
      setInlineError('No speech was captured. Please click Describe by Voice and speak near your microphone.');
      return;
    }

    setProcessing(true);
    setInlineError('');
    try {
      const fd = new FormData();
      fd.append('transcript', combinedTranscript);
      fd.append('address', address || '');
      fd.append('ward', ward || '');
      fd.append('latitude', String(position?.lat ?? 27.4924));
      fd.append('longitude', String(position?.lng ?? 77.6737));
      if (audioBlob && audioBlob.size > 0) {
        const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        fd.append('audio', audioBlob, `voice-report.${ext}`);
      }

      const result = await apiRequest('/api/complaints/voice-extract', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });

      onExtracted?.(result);
      showToast('Voice processed! Report form fields have been filled automatically.', 'success');
    } catch (err) {
      setInlineError(err.message || 'Could not process voice input.');
      showToast(err.message || 'Voice processing failed.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    await stopRecorderAndGetBlob();
    cleanupMedia();
    setRecording(false);
    setFinalTranscript('');
    setInterimTranscript('');
    setElapsedSec(0);
  };

  const liveCaption = [finalTranscript, interimTranscript].filter(Boolean).join(' ').trim();

  return (
    <div className="rounded-xl border border-[#245B45]/18 bg-[#F5F1DC]/65 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              recording ? 'bg-[#F07832] text-white' : 'bg-[#D5EBDD] text-[#245B45]'
            }`}
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#245B45] flex items-center gap-1.5">
              <span>Voice-to-Form AI Intake</span>
              {recording && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F07832] font-mono-tabular">
                  <span className="w-2 h-2 rounded-full bg-[#F07832] animate-pulse" />
                  {formatDuration(elapsedSec)}
                </span>
              )}
            </p>
            <p className="text-[11px] text-[#55665F] truncate">
              {recording
                ? 'Listening via microphone — describe the issue and nearby landmark'
                : processing
                  ? 'Processing audio stream with AI to fill your form...'
                  : 'Speak naturally and AI will fill the headline, details, category & location'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!recording && !processing && (
            <>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                aria-label="Speech recognition language"
                className="rounded-lg border border-[#245B45]/20 bg-white px-2 py-1.5 text-xs text-[#24332D]"
              >
                {SPEECH_LANGS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <Button type="button" size="sm" variant="secondary" onClick={startRecording}>
                <Mic className="w-3.5 h-3.5" />
                <span>Describe by Voice</span>
              </Button>
            </>
          )}

          {recording && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={handleCancel}>
                <MicOff className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={handleStopAndExtract}>
                <Square className="w-3 h-3 fill-current" />
                <span>Stop & Auto-Fill Form</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(recording || processing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: FG_EASE }}
            className="overflow-hidden space-y-2.5"
          >
            {/* Real-time audio stream level bars */}
            {recording && (
              <div className="flex items-center gap-3 rounded-lg bg-white/85 border border-[#245B45]/12 px-3 py-2">
                <Volume2 className="w-4 h-4 text-[#245B45] shrink-0" />
                <div className="flex items-end gap-1 h-5 flex-1">
                  {bars.map((level, idx) => (
                    <span
                      key={idx}
                      style={{ height: `${Math.round(level * 100)}%` }}
                      className="flex-1 rounded-full bg-[#F07832] transition-all duration-75"
                    />
                  ))}
                </div>
                <span className="text-[11px] text-[#55665F] shrink-0">
                  {speechSupported ? 'Web Speech + Audio active' : 'Audio stream active'}
                </span>
              </div>
            )}

            {/* Live transcript preview */}
            <div className="rounded-lg bg-white border border-[#245B45]/14 px-3 py-2.5 text-xs">
              <span className="text-[11px] font-semibold text-[#245B45] flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-[#F07832]" />
                <span>Live Speech Transcript</span>
              </span>
              <p className="text-[#24332D] leading-relaxed min-h-[1.25rem]">
                {liveCaption || (
                  <span className="text-[#55665F] italic">
                    {speechSupported
                      ? 'Start speaking — e.g. "There is a broken streetlight with an exposed wire near Krishna Nagar crossing"...'
                      : 'Recording audio stream — click Stop & Auto-Fill Form when finished.'}
                  </span>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {inlineError && (
        <p className="text-xs text-[#9B2226] bg-[#F3D7DD]/55 border border-[#9B2226]/20 rounded-lg px-3 py-2">
          {inlineError}
        </p>
      )}
    </div>
  );
}
