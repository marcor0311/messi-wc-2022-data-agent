'use client';
import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { SendIcon } from './icons';
import type { Model } from './types';

const MAX = 4000;

type Props = {
  value: string; onChange: (v: string) => void; onSubmit: () => void;
  models: Model[]; model: string; onModel: (m: string) => void;
  canSend: boolean; pending: boolean; authenticated: boolean;
};

/* Pattern reference: deepseek-ai/chat-demo (MIT) — auto-growing input, Enter to send, Shift+Enter for a new line,
   IME-safe. Re-implemented here; no code was copied. */
export default function Composer({ value, onChange, onSubmit, models, model, onModel, canSend, pending }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = area.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 192) + 'px';
  }, [value]);
  const submit = (e: FormEvent) => { e.preventDefault(); if (canSend) onSubmit(); };
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault(); if (canSend) onSubmit();
  };
  return <form className="ap-composer" onSubmit={submit} aria-label="Nueva pregunta">
    <div className="ap-composer-box">
      <label htmlFor="ap-question" className="ap-sr">Tu pregunta sobre el Mundial de Messi</label>
      <textarea id="ap-question" ref={area} rows={1} value={value} maxLength={MAX} onChange={e => onChange(e.target.value)} onKeyDown={key}
        placeholder="Pregunta sobre el Mundial de Messi…" />
      <div className="ap-composer-bar">
        <label className="ap-select"><span>Modelo</span>
          <select aria-label="Modelo" title={models.find(m => m.slug === model)?.display_name} value={model} onChange={e => onModel(e.target.value)} disabled={!models.length}>
            {!models.length ? <option value="">Al iniciar sesión</option> : models.map(m => <option key={m.slug} value={m.slug}>{m.display_name}</option>)}
          </select>
        </label>
        {value.length > MAX - 500 ? <span className="ap-count" aria-live="polite">{value.length.toLocaleString('es')}/{MAX.toLocaleString('es')}</span> : null}
        <button type="submit" className="ap-send" disabled={!canSend} aria-label={pending ? 'Consultando los datos' : 'Enviar pregunta'}><SendIcon /></button>
      </div>
    </div>
  </form>;
}
