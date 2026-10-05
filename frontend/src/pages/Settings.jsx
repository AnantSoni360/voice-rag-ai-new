import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Brain, Database,
  Save, Shield, Cpu, Phone, Link
} from 'lucide-react';
import { toast } from '../components/Toast';

function Toggle({ enabled, onChange, id }) {
  return (
    <div
      id={id}
      onClick={() => onChange(!enabled)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: enabled ? 'var(--orange-500)' : 'var(--border-medium)',
        position: 'relative', transition: 'background 0.2s ease', flexShrink: 0
      }}
    >
      <motion.div
        animate={{ x: enabled ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          position: 'absolute', top: 2, width: 20, height: 20,
          borderRadius: '50%', background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
        }}
      />
    </div>
  );
}

function Section({ title, icon: Icon, children, delay = 0 }) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ marginBottom: 20 }}
    >
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--orange-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange-500)' }}>
            <Icon size={15} />
          </div>
          <div className="card-title">{title}</div>
        </div>
      </div>
      <div className="card-body">
        {children}
      </div>
    </motion.div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-light)'
    }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState({
    ollamaUrl: 'http://localhost:11434',
    model: 'llama3.2',
    embeddingModel: 'nomic-embed-text',
    chunkSize: 512,
    chunkOverlap: 64,
    topK: 5,
    minScore: 0.72,
    defaultLang: 'hi-en',
    hindiEnabled: true,
    englishEnabled: true,
    ttsEnabled: true,
    leadScoringEnabled: true,
    auditLogsEnabled: true,
    maxAudioMb: 10,
    sessionTimeout: 30,
    requireConsent: true,
    hallucGuard: true,
  });

  const [webhookUrl, setWebhookUrl] = useState(
    () => localStorage.getItem('twilio_webhook_url') || 'https://sambash-ai-twilio-demo.loca.lt'
  );

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }));

  const save = () => {
    localStorage.setItem('twilio_webhook_url', webhookUrl.trim());
    toast.success('Settings Saved', 'Configuration updated successfully.');
  };

  return (
    <div className="page-content">
      <div className="page-header-row" style={{ marginBottom: 24 }}>
        <div className="page-header">
          <h1 className="page-title">System <span>Settings</span></h1>
          <p className="page-desc">Configure the AI model, voice pipeline, retrieval and security.</p>
        </div>
        <button className="btn btn-primary" onClick={save} id="save-settings-btn">
          <Save size={14} /> Save Changes
        </button>
      </div>

      {/* Twilio / Telephony */}
      <Section title="Twilio / Telephony" icon={Phone} delay={0}>
        <SettingRow
          label="Webhook Base URL"
          desc="Public HTTPS URL (e.g. localtunnel) that Twilio uses to reach your backend. Must be running before placing calls."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <input
              id="twilio-webhook-url"
              className="form-input"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://your-tunnel.loca.lt"
              style={{ width: 300, fontFamily: 'monospace', fontSize: 12 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <Link size={11} />
              Start tunnel: <code style={{ background: 'var(--bg-main)', padding: '1px 6px', borderRadius: 4 }}>npx localtunnel --port 8000</code>
            </div>
          </div>
        </SettingRow>
        <SettingRow label="Twilio Phone Number" desc="Your Twilio outbound caller ID">
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)', padding: '4px 10px', background: 'var(--bg-main)', borderRadius: 6 }}>+17372508034</div>
        </SettingRow>
      </Section>

      {/* Ollama / LLM */}
      <Section title="LLM Configuration (Ollama)" icon={Brain} delay={0.05}>
        <SettingRow label="Ollama API URL" desc="Local endpoint for the Ollama inference server">
          <input className="form-input" value={cfg.ollamaUrl} onChange={e => set('ollamaUrl', e.target.value)} style={{ width: 260 }} id="ollama-url" />
        </SettingRow>
        <SettingRow label="Chat Model" desc="Model used for response generation">
          <select className="form-select" value={cfg.model} onChange={e => set('model', e.target.value)} style={{ width: 200 }} id="chat-model">
            <option>llama3.2</option>
            <option>llama3.1</option>
            <option>mistral</option>
            <option>qwen2.5</option>
            <option>deepseek-r1</option>
          </select>
        </SettingRow>
        <SettingRow label="Embedding Model" desc="Model used for document and query embeddings">
          <select className="form-select" value={cfg.embeddingModel} onChange={e => set('embeddingModel', e.target.value)} style={{ width: 200 }} id="embedding-model">
            <option>nomic-embed-text</option>
            <option>mxbai-embed-large</option>
            <option>all-minilm</option>
          </select>
        </SettingRow>
        <SettingRow label="Hallucination Guard" desc="Reject answers that lack retrieved evidence">
          <Toggle enabled={cfg.hallucGuard} onChange={v => set('hallucGuard', v)} id="halluc-guard-toggle" />
        </SettingRow>
      </Section>

      {/* RAG Retrieval */}
      <Section title="RAG Retrieval Settings" icon={Database} delay={0.12}>
        <SettingRow label="Chunk Size (tokens)" desc="Document chunk size for embedding">
          <input type="number" className="form-input" value={cfg.chunkSize} onChange={e => set('chunkSize', +e.target.value)} style={{ width: 100 }} id="chunk-size" />
        </SettingRow>
        <SettingRow label="Chunk Overlap (tokens)" desc="Overlap between adjacent chunks">
          <input type="number" className="form-input" value={cfg.chunkOverlap} onChange={e => set('chunkOverlap', +e.target.value)} style={{ width: 100 }} id="chunk-overlap" />
        </SettingRow>
        <SettingRow label="Top-K Retrieved Chunks" desc="Number of chunks returned per query">
          <input type="number" className="form-input" value={cfg.topK} onChange={e => set('topK', +e.target.value)} style={{ width: 100 }} id="top-k" />
        </SettingRow>
        <SettingRow label="Minimum Relevance Score" desc="Chunks below this threshold are discarded (0–1)">
          <input type="number" step="0.01" min="0" max="1" className="form-input" value={cfg.minScore} onChange={e => set('minScore', +e.target.value)} style={{ width: 100 }} id="min-score" />
        </SettingRow>
      </Section>

      {/* Voice & Language */}
      <Section title="Voice & Language" icon={Globe} delay={0.2}>
        <SettingRow label="Default Language" desc="Pre-selected language for new sessions">
          <select className="form-select" value={cfg.defaultLang} onChange={e => set('defaultLang', e.target.value)} style={{ width: 200 }} id="default-lang">
            <option value="hi-en">Hindi + English</option>
            <option value="hi">Hindi only</option>
            <option value="en">English only</option>
          </select>
        </SettingRow>
        <SettingRow label="Hindi Support" desc="Enable faster-whisper Hindi transcription">
          <Toggle enabled={cfg.hindiEnabled} onChange={v => set('hindiEnabled', v)} id="hindi-toggle" />
        </SettingRow>
        <SettingRow label="Text-to-Speech" desc="Read AI responses aloud using browser SpeechSynthesis">
          <Toggle enabled={cfg.ttsEnabled} onChange={v => set('ttsEnabled', v)} id="tts-toggle" />
        </SettingRow>
        <SettingRow label="Max Audio Upload (MB)" desc="Maximum size of an audio recording chunk">
          <input type="number" className="form-input" value={cfg.maxAudioMb} onChange={e => set('maxAudioMb', +e.target.value)} style={{ width: 100 }} id="max-audio" />
        </SettingRow>
      </Section>

      {/* Lead Intelligence */}
      <Section title="Lead Intelligence" icon={Cpu} delay={0.28}>
        <SettingRow label="Lead Scoring Engine" desc="Enable rule-based qualification scoring per conversation">
          <Toggle enabled={cfg.leadScoringEnabled} onChange={v => set('leadScoringEnabled', v)} id="lead-scoring-toggle" />
        </SettingRow>
        <SettingRow label="Scoring Thresholds" desc="High ≥ 70 · Medium 40–69 · Nurture < 40">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '5px 10px', background: 'var(--success-bg)', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>70–100</div>
            <div style={{ padding: '5px 10px', background: 'var(--orange-100)', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700, color: 'var(--orange-700)' }}>40–69</div>
            <div style={{ padding: '5px 10px', background: 'var(--error-bg)', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700, color: 'var(--error)' }}>0–39</div>
          </div>
        </SettingRow>
      </Section>

      {/* Security */}
      <Section title="Security & Privacy" icon={Shield} delay={0.36}>
        <SettingRow label="Require Customer Consent" desc="Display consent notice before recording begins">
          <Toggle enabled={cfg.requireConsent} onChange={v => set('requireConsent', v)} id="consent-toggle" />
        </SettingRow>
        <SettingRow label="Audit Logging" desc="Log all agent configuration changes and sensitive actions">
          <Toggle enabled={cfg.auditLogsEnabled} onChange={v => set('auditLogsEnabled', v)} id="audit-toggle" />
        </SettingRow>
        <SettingRow label="Session Timeout (minutes)" desc="Automatically end inactive voice sessions">
          <input type="number" className="form-input" value={cfg.sessionTimeout} onChange={e => set('sessionTimeout', +e.target.value)} style={{ width: 100 }} id="session-timeout" />
        </SettingRow>
        <SettingRow label="API Health Check" desc="">
          <a href="http://localhost:8000/health" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" id="health-check-btn">
            Check Status
          </a>
        </SettingRow>
      </Section>
    </div>
  );
}
