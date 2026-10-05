import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Volume2, VolumeX, PhoneOff,
  Globe, User, Bot, FileText, Loader, CheckCircle, Zap
} from 'lucide-react';
import { toast } from '../components/Toast';
import { ragChat, startSession, endSession, transcribeAudio } from '../api/client';

const LANGUAGES = [
  { code: 'hi', label: 'हिंदी (Hindi)', flag: '🇮🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi-en', label: 'Hindi + English', flag: '🌐' },
];

const WELCOME_MESSAGE = {
  role: 'ai',
  text: 'नमस्ते! मैं Sambash AI हूं — आपका multilingual sales assistant।\n\nHello! I am Sambash AI, your multilingual voice sales assistant for Nexus CRM. Ask me anything about features, pricing, or how Nexus CRM can help your team. 🚀',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  source: null,
  confidence: null,
};

const STATUS_CONFIG = {
  idle:       { label: 'Ready',      color: 'var(--text-muted)',  bg: 'var(--bg-secondary)' },
  listening:  { label: 'Listening…', color: 'var(--orange-600)', bg: 'var(--orange-50)'  },
  processing: { label: 'Processing…',color: 'var(--warning)',    bg: 'var(--warning-bg)' },
  speaking:   { label: 'Speaking…',  color: 'var(--info)',       bg: 'var(--info-bg)'    },
  error:      { label: 'Error',      color: 'var(--error)',      bg: 'var(--error-bg)'   },
};

function WaveformDisplay({ active, status }) {
  const bars = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 3, height: 80, padding: '0 12px'
    }}>
      {bars.map(i => (
        <motion.div
          key={i}
          style={{
            width: 3, borderRadius: 8,
            background: status === 'speaking'
              ? 'var(--info)'
              : status === 'listening'
              ? 'var(--orange-400)'
              : 'var(--border-medium)',
          }}
          animate={active ? {
            height: [6, (i % 5) * 10 + 8, 6],
            opacity: [0.4, 1, 0.4]
          } : { height: 4, opacity: 0.2 }}
          transition={{
            duration: 0.6 + (i % 3) * 0.3,
            repeat: Infinity,
            delay: i * 0.04,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
}

function ScoreCircle({ score }) {
  const r = 30, c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--orange-500)' : 'var(--error)';
  return (
    <div className="score-circle">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border-light)" strokeWidth="6" />
        <motion.circle
          cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={c - dash}
          strokeLinecap="round"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="score-circle-text">
        <span>{score}</span>
        <span className="score-circle-label">Score</span>
      </div>
    </div>
  );
}

export default function VoiceAgent() {
  const [status, setStatus] = useState('idle');
  const [lang, setLang] = useState('hi-en');
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [sessionId, setSessionId] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [leadData, setLeadData] = useState({
    name: 'Waiting for extraction...',
    company: '-',
    requirements: '-',
    budget: '-',
    timeline: '-',
    authority: '-',
    objection: '-',
    score: 0,
    status: 'New',
    nextAction: 'Complete conversation to extract lead',
  });

  const transcriptRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const sendTextMessage = useCallback(async (userText) => {
    if (!userText.trim()) return;
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: userText, time: userTime, source: null }]);
    setStatus('processing');

    // Start session if needed
    let sid = sessionId;
    if (!sid) {
      try {
        const res = await startSession(lang);
        sid = res.data.session_id;
        setSessionId(sid);
      } catch (e) {
        console.error('Session creation failed:', e);
      }
    }

    try {
      const payload = {
        message: userText,
        language: lang,
        session_id: sid,
        conversation_history: conversationHistory.slice(-6),
        use_fast_model: false,
      };
      const { data } = await ragChat(payload);

      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const source = data.sources?.[0]
        ? `${data.sources[0].document} · ${data.sources[0].section}`
        : null;

      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.answer,
        time: aiTime,
        source,
        confidence: data.confidence,
        latency: data.latency_ms,
        found: data.found,
      }]);

      // Update history for next turn
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: data.answer },
      ]);

      // Browser TTS
      setStatus('speaking');
      if (!muted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(data.answer);
        utt.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
        utt.rate = 0.9;
        utt.onend = () => setStatus('idle');
        window.speechSynthesis.speak(utt);
      } else {
        setTimeout(() => setStatus('idle'), 1500);
      }

      if (!data.found) {
        toast.warning('Knowledge Gap', 'This question was not found in the knowledge base.');
      }
    } catch (err) {
      setStatus('error');
      toast.error('RAG Error', err.response?.data?.detail || err.message);
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [lang, muted, sessionId, conversationHistory]);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices) {
      toast.error('Microphone Not Available', 'Your browser does not support audio recording.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setStatus('processing');
        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const res = await transcribeAudio(audioBlob, lang);
          const transcript = res.data.transcript;
          
          if (!transcript.trim()) {
            setStatus('idle');
            toast.warning('Audio unclear', 'Could not hear you. Please try again.');
            return;
          }
          
          toast.success('Transcribed', transcript);
          // Pass the transcript to the chat pipeline
          await sendTextMessage(transcript);
        } catch (err) {
          toast.error('Transcription Error', err.message || 'Failed to transcribe audio.');
          setStatus('idle');
        }
      };

      recorder.start();
      setStatus('listening');
      setSessionActive(true);
      toast.info('Listening', 'Speak now — tap again to send');
    } catch (err) {
      toast.error('Microphone Error', err.message || 'Could not access microphone.');
      setStatus('error');
    }
  }, [lang, sendTextMessage]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleMicClick = () => {
    if (status === 'listening') stopListening();
    else if (status === 'idle') startListening();
  };

  const [textInput, setTextInput] = useState('');

  const handleTextSend = async () => {
    if (!textInput.trim() || status === 'processing') return;
    const msg = textInput;
    setTextInput('');
    setSessionActive(true);
    await sendTextMessage(msg);
  };

  const handleEndSession = async () => {
    window.speechSynthesis?.cancel();
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    if (sessionId) {
      try { 
        setStatus('processing');
        toast.info('Analyzing', 'Extracting lead intelligence...');
        const res = await endSession(sessionId); 
        if (res.data && res.data.lead) {
            setLeadData({
                name: res.data.lead.name || 'Unknown',
                company: res.data.lead.company || '-',
                requirements: res.data.lead.requirements || '-',
                budget: res.data.lead.budget || '-',
                timeline: res.data.lead.timeline || '-',
                authority: res.data.lead.authority || '-',
                objection: res.data.lead.objection || 'None',
                score: res.data.lead.score || 0,
                status: res.data.lead.status === 'qualified' ? 'Qualified' : res.data.lead.status === 'in_progress' ? 'In Progress' : 'Nurture',
                nextAction: res.data.lead.nextAction || 'Follow up required',
            });
            toast.success('Extraction Complete', `Lead scored: ${res.data.lead.score}/100`);
        } else {
            toast.success('Session Ended', 'Conversation saved.');
        }
      } catch (e) {
          console.error('Extraction error:', e);
          toast.error('Extraction Failed', 'Could not score lead.');
      }
    } else {
        toast.success('Session Ended', 'No conversation to save.');
    }
    setStatus('idle');
    setSessionActive(false);
    setSessionId(null);
    setConversationHistory([]);
  };

  const handleTakeAction = () => {
    if (leadData.status === 'New' || !leadData.name || leadData.name === 'Waiting for extraction...') {
      toast.warning('Not Ready', 'Please complete a conversation first.');
      return;
    }
    
    const subject = encodeURIComponent(`Follow up: Nexus CRM - ${leadData.company !== '-' ? leadData.company : 'Your Inquiry'}`);
    const requirementsStr = leadData.requirements !== '-' ? `I understand you are looking for: ${leadData.requirements}.` : 'I am reaching out regarding your recent inquiry.';
    const actionStr = leadData.nextAction !== 'Complete conversation to extract lead' ? `To move forward with our recommended next step (${leadData.nextAction}), I would love to connect.` : 'I would love to connect to discuss how Nexus CRM can help.';
    
    const body = encodeURIComponent(`Hi ${leadData.name.split(' ')[0] || 'there'},\n\nThank you for chatting with Sambash AI today.\n\n${requirementsStr}\n\n${actionStr}\n\nAre you available for a quick 10-minute call sometime this week?\n\nBest regards,\nYour Sales Team`);
    
    // Open default mail client
    window.location.href = `mailto:${leadData.email || ''}?subject=${subject}&body=${body}`;
    toast.success('Action Triggered', 'Opening your email client with a smart draft...');
  };

  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Live <span>Voice Agent</span></h1>
          <p className="page-desc">Multilingual AI sales conversations with real-time transcription.</p>
        </div>
        <div className="filters-row">
          <div style={{ position: 'relative' }}>
            <Globe size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <select
              className="form-select"
              style={{ paddingLeft: 30, fontSize: 13, paddingTop: 7, paddingBottom: 7 }}
              value={lang}
              onChange={e => setLang(e.target.value)}
              id="language-select"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="section-grid" style={{ gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Main Voice Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Voice Controls Card */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          >
            <div className="card-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              {/* Status pill */}
              <motion.div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 'var(--radius-full)',
                  background: statusCfg.bg, color: statusCfg.color,
                  fontSize: 12, fontWeight: 600, marginBottom: 24
                }}
                key={status}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {status === 'processing' && <Loader size={10} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} />}
                {status === 'listening' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange-500)', animation: 'pulse-dot 1s ease-in-out infinite' }} />}
                {status === 'speaking' && <Volume2 size={10} />}
                {status === 'idle' && <CheckCircle size={10} />}
                {statusCfg.label}
              </motion.div>

              {/* Waveform */}
              <WaveformDisplay active={status === 'listening' || status === 'speaking'} status={status} />

              {/* Mic Button */}
              <div style={{ marginTop: 24, marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
                <div
                  className={`voice-status-ring ${status}`}
                  onClick={handleMicClick}
                  id="mic-button"
                  role="button"
                  aria-label={status === 'listening' ? 'Stop recording' : 'Start recording'}
                  style={{ cursor: status === 'processing' || status === 'speaking' ? 'default' : 'pointer' }}
                >
                  <div className="mic-btn-inner">
                    {status === 'listening'
                      ? <MicOff size={28} />
                      : status === 'processing'
                      ? <Loader size={28} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Mic size={28} />}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {status === 'idle' ? 'Tap the microphone to start speaking' :
                 status === 'listening' ? 'Tap again when you finish speaking' :
                 status === 'processing' ? 'Analyzing your message…' :
                 status === 'speaking' ? 'AI is responding — wait or mute' : ''}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button
                  className={`btn ${muted ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                  onClick={() => { setMuted(!muted); window.speechSynthesis?.cancel(); }}
                  id="mute-btn"
                >
                  {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                {sessionActive && (
                  <button className="btn btn-danger btn-sm" onClick={handleEndSession} id="end-session-btn">
                    <PhoneOff size={13} /> End Session
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Transcript */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Conversation Transcript</div>
                <div className="card-subtitle">Live multilingual transcript with source citations</div>
              </div>
              <button className="btn btn-ghost btn-sm">
                <FileText size={12} /> Export
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {/* Text input for RAG queries */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Type a message in Hindi or English… (e.g. Nexus CRM ki pricing kya hai?)"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTextSend()}
                  disabled={status === 'processing'}
                  id="text-message-input"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleTextSend}
                  disabled={!textInput.trim() || status === 'processing'}
                  id="text-send-btn"
                  style={{ flexShrink: 0 }}
                >
                  {status === 'processing'
                    ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Zap size={13} />}
                  Ask AI
                </button>
              </div>

              <div className="transcript-panel" ref={transcriptRef} style={{ borderRadius: '0 0 14px 14px', maxHeight: 380 }}>
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      className={`transcript-msg ${msg.role}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className={`transcript-avatar ${msg.role}`}>
                        {msg.role === 'ai' ? <Bot size={12} /> : <User size={12} />}
                      </div>
                      <div>
                        <div className={`transcript-bubble`}>
                          {msg.text}
                        </div>
                        {msg.source && (
                          <div className="transcript-source">
                            <FileText size={10} /> {msg.source}
                          </div>
                        )}
                        <div className="transcript-time">{msg.time}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {status === 'processing' && (
                  <motion.div
                    className="transcript-msg ai"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  >
                    <div className="transcript-avatar ai"><Bot size={12} /></div>
                    <div className="transcript-bubble" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 0.15, 0.3].map((d, i) => (
                        <motion.div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)'
                        }}
                          animate={{ y: [0, -6, 0] }}
                          transition={{ repeat: Infinity, delay: d, duration: 0.6 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Lead Info Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Score Card */}
          <motion.div
            className="card"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          >
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <ScoreCircle score={leadData.score} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {leadData.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {leadData.company}
              </div>
              <span className="badge badge-success">{leadData.status}</span>
            </div>
          </motion.div>

          {/* Lead Fields */}
          <motion.div
            className="card"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
          >
            <div className="card-header">
              <div className="card-title">Qualification Fields</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Requirements', value: leadData.requirements },
                { label: 'Budget Range', value: leadData.budget },
                { label: 'Timeline', value: leadData.timeline },
                { label: 'Authority', value: leadData.authority },
                { label: 'Main Objection', value: leadData.objection },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {f.value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not yet captured</span>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Next Action */}
          <motion.div
            className="card"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}
            style={{ borderLeft: '3px solid var(--orange-500)' }}
          >
            <div className="card-header">
              <div className="card-title">Recommended Action</div>
            </div>
            <div className="card-body">
              <div style={{
                padding: '12px', background: 'var(--orange-50)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--orange-100)', marginBottom: 12
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange-700)' }}>
                  🎯 {leadData.nextAction}
                </div>
              </div>
              <button className="btn btn-primary w-full btn-sm" id="take-action-btn" onClick={handleTakeAction}>
                Take Action
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
