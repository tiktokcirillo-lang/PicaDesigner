import { useState } from "react";
import {
  Sparkles, Download, RefreshCw, LogOut, Wand2,
  ImageIcon, Loader2, AlertCircle, History, X, ChevronDown
} from "lucide-react";
import { generateDesign, type DesignRequest } from "../lib/gemini";

const DESIGN_TYPES = [
  { value: "logo", label: "Logo" },
  { value: "Instagram post", label: "Post Instagram" },
  { value: "LinkedIn post", label: "Post LinkedIn" },
  { value: "web banner", label: "Banner Web" },
  { value: "business card", label: "Cartão de Visita" },
  { value: "flyer", label: "Flyer" },
  { value: "poster", label: "Poster" },
  { value: "YouTube thumbnail", label: "Thumbnail YouTube" },
  { value: "product mockup", label: "Mockup de Produto" },
  { value: "email header", label: "Header de Email" },
];

const STYLES = [
  { value: "modern and clean", label: "Moderno" },
  { value: "minimalist", label: "Minimalista" },
  { value: "corporate and professional", label: "Corporativo" },
  { value: "bold and creative", label: "Arrojado" },
  { value: "elegant and luxurious", label: "Elegante" },
  { value: "fun and playful", label: "Divertido" },
  { value: "tech and futuristic", label: "Tech/Futurista" },
  { value: "vintage and retro", label: "Vintage/Retrô" },
];

const COLOR_PALETTES = [
  { value: "blue and white professional", label: "Azul & Branco" },
  { value: "black and gold luxury", label: "Preto & Dourado" },
  { value: "purple and pink vibrant", label: "Roxo & Rosa" },
  { value: "green and white natural", label: "Verde & Branco" },
  { value: "orange and dark bold", label: "Laranja & Escuro" },
  { value: "red and white energetic", label: "Vermelho & Branco" },
  { value: "teal and coral modern", label: "Teal & Coral" },
  { value: "monochromatic dark", label: "Monocromático" },
];

interface HistoryItem {
  id: string;
  imageData: string;
  mimeType: string;
  request: DesignRequest;
  createdAt: number;
}

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("pica_history") ?? "[]");
  } catch {
    return [];
  }
}

function saveToHistory(item: HistoryItem) {
  const history = loadHistory();
  const updated = [item, ...history].slice(0, 20);
  localStorage.setItem("pica_history", JSON.stringify(updated));
}

interface DesignerProps {
  apiKey: string;
  onLogout: () => void;
}

export default function Designer({ apiKey, onLogout }: DesignerProps) {
  const [designType, setDesignType] = useState(DESIGN_TYPES[0].value);
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState(STYLES[0].value);
  const [colors, setColors] = useState(COLOR_PALETTES[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imageData: string; mimeType: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  async function handleGenerate() {
    if (!description.trim()) {
      setError("Descreva o que você quer criar.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const req: DesignRequest = { type: designType, description, style, colors };

    try {
      const generated = await generateDesign(apiKey, req);
      setResult(generated);
      const item: HistoryItem = {
        id: Date.now().toString(),
        imageData: generated.imageData,
        mimeType: generated.mimeType,
        request: req,
        createdAt: Date.now(),
      };
      saveToHistory(item);
      setHistory(loadHistory());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar design.";
      setError(msg.includes("API key") ? "API key inválida ou sem permissão. Verifique sua chave." : msg);
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.imageData}`;
    link.download = `picadesigner-${designType.replace(/\s+/g, "-")}-${Date.now()}.png`;
    link.click();
  }

  function loadFromHistory(item: HistoryItem) {
    setResult({ imageData: item.imageData, mimeType: item.mimeType });
    setDesignType(item.request.type);
    setDescription(item.request.description);
    setStyle(item.request.style);
    setColors(item.request.colors);
    setShowHistory(false);
  }

  function clearHistory() {
    localStorage.removeItem("pica_history");
    setHistory([]);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">PicaDesigner</span>
          <span className="text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
            {history.length > 0 && (
              <span className="bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {history.length > 9 ? "9+" : history.length}
              </span>
            )}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Trocar chave</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Controls */}
        <aside className="w-80 border-r border-slate-800 p-5 overflow-y-auto shrink-0 flex flex-col gap-5">
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Tipo de design
            </label>
            <div className="relative">
              <select
                value={designType}
                onChange={(e) => setDesignType(e.target.value)}
                className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition pr-8"
              >
                {DESIGN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(""); }}
              placeholder={`Ex: Logo para uma cafeteria artesanal chamada "Grão & Arte", transmitindo aconchego e qualidade`}
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition resize-none"
            />
            <p className="text-xs text-slate-600 mt-1">Seja específico: nome da marca, setor, tom desejado</p>
          </div>

          {/* Style */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Estilo visual
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`text-xs py-2 px-3 rounded-lg border transition text-left ${
                    style === s.value
                      ? "border-purple-500 bg-purple-600/20 text-purple-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Paleta de cores
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {COLOR_PALETTES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColors(c.value)}
                  className={`text-xs py-2 px-3 rounded-lg border transition text-left ${
                    colors === c.value
                      ? "border-purple-500 bg-purple-600/20 text-purple-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 active:scale-[0.98] mt-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando design...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Gerar Design
              </>
            )}
          </button>
        </aside>

        {/* Main — Output */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto relative">
          {/* History panel */}
          {showHistory && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur z-10 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-white">Histórico de designs</h2>
                <div className="flex items-center gap-3">
                  {history.length > 0 && (
                    <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 transition">
                      Limpar tudo
                    </button>
                  )}
                  <button onClick={() => setShowHistory(false)}>
                    <X className="w-5 h-5 text-slate-400 hover:text-white transition" />
                  </button>
                </div>
              </div>
              {history.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-20">Nenhum design gerado ainda.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500 transition"
                    >
                      <img
                        src={`data:${item.mimeType};base64,${item.imageData}`}
                        alt={item.request.description}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                        <span className="text-xs text-white line-clamp-2">{item.request.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-2 bg-red-950/40 border border-red-900/50 rounded-xl p-4 max-w-lg w-full">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && (
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mx-auto mb-5">
                <ImageIcon className="w-9 h-9 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Seu design aparece aqui</h2>
              <p className="text-slate-500 text-sm">
                Preencha as opções ao lado e clique em <strong className="text-slate-400">Gerar Design</strong> para criar sua primeira peça.
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 rounded-2xl bg-purple-900/30 border border-purple-700/30 flex items-center justify-center mx-auto mb-5 animate-pulse">
                <Sparkles className="w-9 h-9 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Criando seu design...</h2>
              <p className="text-slate-500 text-sm">O Gemini está trabalhando. Costuma levar de 10 a 30 segundos.</p>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="flex flex-col items-center gap-5 max-w-2xl w-full">
              <div className="w-full rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-black/50">
                <img
                  src={`data:${result.mimeType};base64,${result.imageData}`}
                  alt="Design gerado"
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-purple-900/30 active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-6 py-2.5 rounded-xl text-sm transition border border-slate-700 active:scale-[0.98]"
                >
                  <RefreshCw className="w-4 h-4" />
                  Gerar novamente
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
