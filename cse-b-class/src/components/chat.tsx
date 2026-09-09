'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, onRealtime } from '@/lib/client';
import { Badge, Button, Modal, Select, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { fmtDateTime, fmtTime } from '@/lib/dates';
import { Flag, Paperclip, SendHorizonal, ShieldAlert } from 'lucide-react';

export type ChatMessage = {
  id: string;
  body: string | null;
  fileId: string | null;
  createdAt: string;
  deleted: boolean;
  author: { id: string; name: string; role: string; regNo: string | null };
};

const ROLE_BADGE: Record<string, string> = { ADVISOR: 'Advisor', REPRESENTATIVE: 'Rep', ADMIN: 'Admin' };

/**
 * One component backs all three chat modules — main class chat (§17),
 * per-assignment chats (§23) and per-experiment chats (§28) — each with its
 * own endpoint and thread so data/permissions/lifecycles stay independent.
 */
export function ChatView({ endpoint, topic, emojiBan = false }: { endpoint: string; topic: string; emojiBan?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [reportCategory, setReportCategory] = useState('ABUSE');
  const [reportNote, setReportNote] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const canReport = user?.role === 'REPRESENTATIVE' || user?.role === 'ADVISOR' || user?.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: ChatMessage[] }>(endpoint);
      setMessages(r.messages);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }, [endpoint, toast]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onRealtime(topic, load), [topic, load]);

  async function send() {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      let fileId: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('module', 'CHAT');
        const r = await api<{ file: { id: string } }>('/api/files', { method: 'POST', formData: fd });
        fileId = r.file.id;
      }
      await api(endpoint, { method: 'POST', body: { body: text.trim() || undefined, fileId } });
      setText('');
      setFile(null);
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function submitReport() {
    if (!reporting) return;
    try {
      await api('/api/reports', { method: 'POST', body: { messageId: reporting.id, category: reportCategory, description: reportNote || undefined } });
      toast.push('success', 'Reported to the Advisor');
      setReporting(null);
      setReportNote('');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  const isStudent = user?.role === 'STUDENT';

  return (
    <div className="flex h-[calc(100dvh-13rem)] flex-col">
      <div className="slim-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {messages === null ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const own = m.author.id === user?.id;
            if (m.deleted) {
              return (
                <div key={m.id} className="mx-auto w-fit rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-400 dark:bg-slate-800">
                  message cleared by moderation
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${own ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 shadow-card dark:bg-slate-800 dark:text-slate-100'}`}>
                  {!own && (
                    <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                      {m.author.name}
                      {ROLE_BADGE[m.author.role] && <Badge tone="brand">{ROLE_BADGE[m.author.role]}</Badge>}
                    </p>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
                  {m.fileId && (
                    <a
                      href={`/api/files/${m.fileId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${own ? 'bg-white/20 text-white' : 'bg-slate-100 text-brand-700 dark:bg-slate-700 dark:text-brand-400'}`}
                    >
                      <Paperclip className="h-3.5 w-3.5" /> View file
                    </a>
                  )}
                  <p className={`mt-1 flex items-center gap-2 text-[10px] ${own ? 'text-white/60' : 'text-slate-400'}`}>
                    {fmtTime(m.createdAt)}
                    {canReport && !own && (
                      <button onClick={() => setReporting(m)} className="inline-flex items-center gap-0.5 hover:underline" title="Report to Advisor">
                        <Flag className="h-3 w-3" /> report
                      </button>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {file && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800">
            <span className="truncate">{file.name}</span>
            <button onClick={() => setFile(null)} className="ml-2 text-rose-500">remove</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {!emojiBan && (
            <label className="cursor-pointer rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Attach file">
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.zip,.odt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          )}
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={emojiBan ? 'Text only — no emojis' : 'Type a message…'}
            className="max-h-28 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            maxLength={2000}
            aria-label="Message"
          />
          <Button onClick={send} loading={sending} aria-label="Send" className="h-10 w-10 !p-0">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
        {emojiBan && <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400"><ShieldAlert className="h-3 w-3" /> Text and files only. Emojis and stickers are disabled in the class chat.</p>}
      </div>

      <Modal open={!!reporting} onClose={() => setReporting(null)} title="Report this message">
        <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm italic text-slate-600 dark:bg-slate-800 dark:text-slate-300">“{(reporting?.body || 'File attachment').slice(0, 120)}”</p>
        <div className="space-y-3">
          <Select label="Category" value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>
            <option value="ABUSE">Abusive / inappropriate</option>
            <option value="SPAM">Spam</option>
            <option value="INCORRECT">Incorrect information</option>
            <option value="PRIVATE_INFO">Private information shared</option>
            <option value="OTHER">Other</option>
          </Select>
          <Textarea label="Description (optional)" rows={2} value={reportNote} onChange={(e) => setReportNote(e.target.value)} maxLength={500} />
          <p className="text-xs text-slate-400">Reports go privately to the Advisor. Students cannot delete reported content — the Advisor decides any action.</p>
          <Button onClick={submitReport} className="w-full">Submit report</Button>
        </div>
      </Modal>
    </div>
  );
}
