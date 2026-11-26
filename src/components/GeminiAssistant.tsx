import { useState, type FormEvent } from 'react';
import { Send, Loader2, Bot, User, RefreshCw } from 'lucide-react';
import type { ChatMessage, Pharmacy } from '../../shared/types';

interface GeminiAssistantProps {
  selectedPharmacy: Pharmacy | null;
}

const SAMPLE_PROMPTS = [
  '¿Qué farmacias tienen protector solar disponible?',
  '¿Qué precauciones generales conviene tomar si llueve al salir?',
  '¿Qué farmacias atienden las 24 horas y qué productos de higiene tienen?',
];

function renderFormattedLines(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        const isBullet = line.startsWith('- ') || line.startsWith('* ');
        const cleanLine = isBullet ? line.slice(2) : line;

        // Renderizado seguro sin HTML crudo: procesa **negritas** mediante fragmentos React
        const segments = cleanLine.split(/(\*\*[^*]+\*\*)/g);
        const content = segments.map((seg, sIdx) => {
          if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
            return (
              <strong key={sIdx} className="font-semibold text-slate-900">
                {seg.slice(2, -2)}
              </strong>
            );
          }
          return <span key={sIdx}>{seg}</span>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" />
              <p className="flex-1">{content}</p>
            </div>
          );
        }

        return <p key={idx}>{content}</p>;
      })}
    </div>
  );
}

export function GeminiAssistant({ selectedPharmacy }: GeminiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola. Soy el asistente inteligente de Botica Atlas. Puedo consultar en tiempo real el inventario de productos, precios, horarios de cada farmacia, el pronóstico meteorológico de la sucursal seleccionada o responder dudas generales de cuidado personal.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);

  const sendMessage = async (textToSend: string, isRetry = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError(null);
    setFailedPrompt(null);

    const historyForServer = messages
      .filter((m) => m.id !== 'welcome')
      .slice(0, isRetry ? -1 : undefined)
      .map((m) => ({ role: m.role, text: m.text }));

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyForServer,
          selectedPharmacyId: selectedPharmacy?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo obtener respuesta del asistente.');
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        sourcesUsed: Array.isArray(data.sourcesUsed) ? data.sourcesUsed : [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setFailedPrompt(trimmed);
      setError(
        err instanceof Error
          ? err.message
          : 'Error al comunicarse con el servicio de Gemini.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <section aria-labelledby="assistant-heading" className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h2 id="assistant-heading" className="font-display text-2xl font-bold text-slate-900">
          Asistente inteligente conectado al catálogo
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Consulta disponibilidad real en farmacias, horarios, clima actual o recomendaciones
          generales de cuidado personal mediante la API de Gemini.
        </p>
      </div>

      {/* Consultas rápidas de prueba */}
      <div className="mt-5 flex flex-wrap gap-2">
        {SAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:border-teal-700 hover:text-teal-800 disabled:opacity-50 cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Conversación en vivo con Gemini
          </span>
          {selectedPharmacy && (
            <span>
              Sucursal en contexto: <strong className="text-slate-800">{selectedPharmacy.name}</strong>
            </span>
          )}
        </div>

        <div className="max-h-[460px] min-h-[320px] space-y-4 overflow-y-auto p-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    isUser
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  ) : (
                    <>
                      {renderFormattedLines(msg.text)}
                      {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                        <p className="mt-2.5 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                          Datos consultados: {msg.sourcesUsed.join(' · ')}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <span>Consultando catálogo en vivo y redactando respuesta...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-red-200 bg-red-50 px-5 py-3 text-xs text-red-800">
            <span>{error}</span>
            {failedPrompt && (
              <button
                type="button"
                onClick={() => sendMessage(failedPrompt, true)}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 cursor-pointer shrink-0"
              >
                <RefreshCw className="h-3 w-3" />
                Reintentar
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta sobre productos, farmacias o cuidados..."
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
