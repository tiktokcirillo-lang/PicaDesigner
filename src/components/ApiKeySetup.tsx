import { useState } from "react";
import { Sparkles, Key, ExternalLink, Eye, EyeOff, AlertCircle } from "lucide-react";
import { validateApiKey } from "../lib/gemini";

interface ApiKeySetupProps {
  onKeySubmit: (key: string) => void;
}

export default function ApiKeySetup({ onKeySubmit }: ApiKeySetupProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) {
      setError("Cole sua API key do Gemini.");
      return;
    }
    if (!validateApiKey(key.trim())) {
      setError("API key inválida. Ela deve começar com 'AI' e ter mais de 20 caracteres.");
      return;
    }
    localStorage.setItem("pica_gemini_key", key.trim());
    onKeySubmit(key.trim());
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600 mb-4 shadow-lg shadow-purple-900/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">PicaDesigner</h1>
          <p className="text-slate-400 mt-2 text-sm">Designer profissional com IA — grátis com sua chave Gemini</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Conecte sua API Key</h2>
              <p className="text-slate-500 text-xs">Gratuita no Google AI Studio</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setError(""); }}
                  placeholder="AIza..."
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 pr-10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <div className="flex items-center gap-1.5 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl text-sm transition shadow-lg shadow-purple-900/30 active:scale-[0.98]"
            >
              Começar a criar
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 mb-3">Como obter sua API key gratuita:</p>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex gap-2 items-start">
                <span className="bg-purple-600/20 text-purple-400 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Acesse o Google AI Studio</span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="bg-purple-600/20 text-purple-400 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Clique em <strong className="text-slate-300">"Get API key"</strong> → <strong className="text-slate-300">"Create API key"</strong></span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="bg-purple-600/20 text-purple-400 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>Cole a chave acima e comece a criar</span>
              </div>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Google AI Studio
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Sua chave fica salva apenas no seu navegador. Não enviamos para nenhum servidor.
        </p>
      </div>
    </div>
  );
}
