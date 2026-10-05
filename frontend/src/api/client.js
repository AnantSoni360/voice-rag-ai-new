/**
 * Centralized API client for Voice RAG AI backend.
 * Base URL: http://localhost:8000
 */
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Voice / RAG ──────────────────────────────────────────────────────────────
export const startSession = (language = 'hi-en') =>
  api.post('/api/voice/session/start', null, { params: { language } });

export const endSession = (sessionId) =>
  api.post(`/api/voice/session/${sessionId}/end`);

export const ragChat = (payload) =>
  api.post('/api/voice/chat', payload);

export const transcribeAudio = (audioBlob, language = 'hi') => {
  const form = new FormData();
  form.append('audio', audioBlob, 'recording.webm');
  form.append('language', language);
  return api.post('/api/voice/transcribe', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const listDocuments = () => api.get('/api/documents/');

export const uploadDocument = (file, onUploadProgress) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/api/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
};

export const deleteDocument = (id) => api.delete(`/api/documents/${id}`);

export const collectionStats = () => api.get('/api/documents/stats/collection');

// ─── Leads ────────────────────────────────────────────────────────────────────
export const listLeads = (params) => api.get('/api/leads/', { params });
export const getLead = (id) => api.get(`/api/leads/${id}`);
export const updateLeadStatus = (id, status) =>
  api.patch(`/api/leads/${id}/status`, null, { params: { status } });

// ─── Conversations ────────────────────────────────────────────────────────────
export const listConversations = (params) => api.get('/api/conversations/', { params });
export const getMessages = (convId) => api.get(`/api/conversations/${convId}/messages`);

// ─── Outbound ─────────────────────────────────────────────────────────────────
export const listOutboundTasks = () => api.get('/api/outbound/');
export const createOutboundTask = (data) => api.post('/api/outbound/', data);
export const startOutboundCall = (taskId) => {
  const baseUrl = localStorage.getItem('twilio_webhook_url');
  if (!baseUrl) {
    alert("Please set your ngrok webhook URL in the browser console first!\n\nlocalStorage.setItem('twilio_webhook_url', 'https://your-url.ngrok-free.app')");
    return Promise.reject(new Error("Missing webhook URL"));
  }
  return api.post(`/api/twilio/${taskId}/start?base_url=${encodeURIComponent(baseUrl)}`);
};
export const endOutboundCall = (taskId) => api.post(`/api/outbound/${taskId}/end`);

// ─── Analytics ──────────────────────────────────────────────────────────────────
export const getDashboardStats = (timeframe = '7d') => api.get('/api/analytics/dashboard', { params: { timeframe } });

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthCheck = () => api.get('/health');

export default api;
