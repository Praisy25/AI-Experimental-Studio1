"use client";

import { Children, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { apiFetch, API_URL } from "../lib/api";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { showToast } from "../lib/toast";

type Workspace = { id: string; name: string; systemPrompt: string | null };
type ChatSummary = { id: string; title: string; modelName: string | null; memoryEnabled: boolean; workspaceId: string | null; updatedAt: string; _count?: { messages: number } };
type Message = { id: string; role: "user" | "assistant"; content: string | null; status: string; modelName: string | null; durationMs: number | null; estimatedCostUsd?: number | null; sources?: Array<{ name: string }> | null; createdAt: string };
type Provider = { id: string; provider: string; displayName: string; defaultModel: string | null; contextLength: number | null; strengths: string | null; weaknesses: string | null; averageResponseMs: number | null; responseSamples: number; inputPricePerMillion: number | null; outputPricePerMillion: number | null };
type OllamaModel = { name: string; size: number; averageResponseMs?: number | null; responseSamples?: number };
type CompareTarget = { key: number; providerId: string; modelName: string };
type StreamEvent = { type: string; token?: string; error?: string; title?: string; userMessage?: Message; assistantMessage?: Message };

function MarkdownPre({ children }: { children?: ReactNode }) {
  const firstChild = Children.toArray(children)[0];
  const codeElement = isValidElement<{ children?: ReactNode; className?: string }>(firstChild) ? firstChild : null;
  const codeChildren = codeElement?.props.children ?? firstChild;
  const source = Children.toArray(codeChildren).map((child) => typeof child === "string" || typeof child === "number" ? String(child) : "").join("");
  const language = codeElement?.props.className?.match(/language-([\w+-]+)/)?.[1]?.toLowerCase() || "text";
  if (language === "mermaid") return <MermaidDiagram source={source} />;
  return <div className="relative my-3 max-w-full"><button type="button" onClick={() => void navigator.clipboard.writeText(source)} className="absolute right-2 top-2 rounded border border-white/10 bg-[#15171d] px-2 py-1 text-[11px] text-slate-300 hover:text-white">Copy code</button><pre className="max-w-full overflow-x-auto rounded-lg bg-black/40 p-4 pt-10 text-xs leading-5"><code className={`language-${language} font-mono`}>{highlightCode(source)}</code></pre></div>;
}

function highlightCode(source: string): ReactNode[] {
  const pattern = /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|async|await|try|catch|throw|def|print|self|None|True|False|and|or|not|SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE|TABLE|INTO|VALUES|AS|AND|OR|NOT|NULL|true|false|null)\b|\b\d+(?:\.\d+)?\b)/g;
  return source.split(pattern).filter(Boolean).map((part, index) => {
    const kind = /^(?:\/\/|#|--|\/\*)/.test(part) ? "text-slate-500" : /^(?:"|'|`)/.test(part) ? "text-emerald-300" : /^(?:\d)/.test(part) ? "text-amber-200" : /^(?:const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|async|await|try|catch|throw|def|print|self|None|True|False|and|or|not|SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE|TABLE|INTO|VALUES|AS|AND|OR|NOT|NULL|true|false|null)$/.test(part) ? "text-sky-300" : "";
    return kind ? <span key={index} className={kind}>{part}</span> : part;
  });
}

function MermaidDiagram({ source }: { source: string }) {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("%%"));
  const direction = lines[0]?.match(/^(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)\b/i)?.[1]?.toUpperCase() || "TD";
  const edges: Array<[string, string, string]> = [];
  const labels = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const match = line.match(/^([\w-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?\s*--?>\s*(?:\|([^|]+)\|\s*)?([\w-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?$/);
    if (match) {
      const [, from, fromBox, fromRound, fromDiamond, edgeLabel, to, toBox, toRound, toDiamond] = match;
      labels.set(from, fromBox || fromRound || fromDiamond || labels.get(from) || from);
      labels.set(to, toBox || toRound || toDiamond || labels.get(to) || to);
      edges.push([from, to, edgeLabel || ""]);
      continue;
    }
    const declaration = line.match(/^([\w-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})$/);
    if (declaration) labels.set(declaration[1], declaration[2] || declaration[3] || declaration[4]);
  }
  if (!edges.length) return <pre className="my-3 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-slate-300">{source}</pre>;
  const ids = [...new Set(edges.flatMap(([from, to]) => [from, to]))];
  const horizontal = direction === "LR" || direction === "RL";
  const width = horizontal ? Math.max(500, ids.length * 190) : 560;
  const height = horizontal ? 190 : Math.max(220, ids.length * 100);
  const positions = new Map(ids.map((id, index) => [id, horizontal ? { x: 95 + index * 180, y: 82 } : { x: width / 2, y: 55 + index * 90 }]));
  return <div className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3" role="img" aria-label="Mermaid flowchart"><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto max-w-none">
    <defs><marker id="chat-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#a78bfa" /></marker></defs>
    {edges.map(([from, to, label], index) => { const a = positions.get(from)!; const b = positions.get(to)!; const midX = (a.x + b.x) / 2; const midY = (a.y + b.y) / 2; return <g key={`${from}-${to}-${index}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a78bfa" strokeWidth="2" markerEnd="url(#chat-arrow)" />{label && <text x={midX} y={midY - 7} textAnchor="middle" fill="#cbd5e1" fontSize="12">{label}</text>}</g>; })}
    {ids.map((id) => { const point = positions.get(id)!; const label = labels.get(id) || id; const nodeWidth = Math.min(150, Math.max(88, label.length * 8 + 28)); return <g key={id}><rect x={point.x - nodeWidth / 2} y={point.y - 25} width={nodeWidth} height="50" rx="12" fill="#211a39" stroke="#8b5cf6" strokeWidth="1.5" /><text x={point.x} y={point.y + 4} textAnchor="middle" fill="#f8fafc" fontSize="13">{label}</text></g>; })}
  </svg></div>;
}

function normalizeBareMath(markdown: string) {
  return markdown.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part, index) => {
    if (index % 2 === 1) return part;
    return part.replace(/(?<!\\)\(([^()\n]{1,220})\)/g, (whole, expression: string) => {
      if (/\$|\\\(|\\\[/.test(expression)) return whole;
      if (/\\(?:frac|sqrt|sum|int|cdot|times|pm|alpha|beta|theta|pi|infty)\b/.test(expression)) return `$$${expression.trim()}$$`;
      if (/\b[A-Za-z][A-Za-z0-9_{}^ ]{0,30}\s*[=<>]\s*[-A-Za-z0-9_{}^\\+*/. ]{1,80}/.test(expression)) return `$${expression.trim()}$`;
      return whole;
    });
  }).join("");
}

function MathMarkdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ pre: MarkdownPre, code: ({ className, children }) => <code className={className ? `${className} font-mono` : "rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]"}>{children}</code>, a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{normalizeBareMath(content)}</ReactMarkdown>;
}

function parseEvaluation(content: string | null) {
  if (!content) return null;
  try {
    const value = JSON.parse(content);
    if (typeof value?.winner === "string" && typeof value?.rationale === "string") return value as { winner: string; rationale: string; quality?: number; accuracy: number; readability?: number; confidence?: number; technicalDepth?: number; creativity: number; helpfulness: number; hallucinationRisk: number };
  } catch { /* A failed or malformed judge response is shown as text. */ }
  return null;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body as T;
}

async function streamChat(path: string, init: RequestInit, onEvent: (event: StreamEvent) => void) {
  const response = await apiFetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed.");
  }
  if (!response.body) throw new Error("This browser could not read the response stream.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    try {
      const event = JSON.parse(line.slice(5).trim()) as StreamEvent;
      if (event && typeof event.type === "string") onEvent(event);
    } catch { /* Ignore incomplete or malformed stream events. */ }
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n"); buffer = lines.pop() || "";
    for (const line of lines) consume(line.trimEnd());
    if (done) break;
  }
  if (buffer.trim()) consume(buffer.trimEnd());
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [externalAiEnabled, setExternalAiEnabled] = useState(false);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [chatId, setChatId] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelName, setModelName] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareTargets, setCompareTargets] = useState<CompareTarget[]>([]);
  const [debateMode, setDebateMode] = useState(false);
  const [judgeProviderId, setJudgeProviderId] = useState("");
  const [judgeModelName, setJudgeModelName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [improvedPrompt, setImprovedPrompt] = useState("");
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState("");
  const [analyzingMessageId, setAnalyzingMessageId] = useState("");
  const [error, setError] = useState("");
  const generationController = useRef<AbortController | null>(null);

  const loadChats = useCallback(async () => {
    const result = await requestJson<ChatSummary[]>("/api/chats");
    setChats(result);
    return result;
  }, []);

  const loadChat = useCallback(async (id: string) => {
    const result = await requestJson<{ id: string; title: string; modelName: string | null; providerConnectionId: string | null; workspaceId: string | null; memoryEnabled: boolean; messages: Message[] }>(`/api/chats/${encodeURIComponent(id)}`);
    setChatId(result.id);
    if (result.workspaceId) setWorkspaceId(result.workspaceId);
    setMessages(result.messages);
    setMemoryEnabled(result.memoryEnabled);
    if (result.modelName) setModelName(result.modelName);
    if (result.providerConnectionId) setProviderId(result.providerConnectionId);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      requestJson<ChatSummary[]>("/api/chats"),
      requestJson<Workspace[]>("/api/workspaces"),
      requestJson<Provider[]>("/api/providers"),
      requestJson<{ externalAiEnabled: boolean }>("/api/runtime-config").catch(() => ({ externalAiEnabled: false })),
      requestJson<OllamaModel[]>("/api/models").catch(() => [] as OllamaModel[]),
    ]).then(([chatItems, workspaceItems, providerItems, runtimeConfig, localModels]) => {
      if (!active) return;
      setChats(chatItems); setWorkspaces(workspaceItems); setProviders(providerItems); setExternalAiEnabled(runtimeConfig.externalAiEnabled); setModels(localModels);
      const requestedId = new URLSearchParams(window.location.search).get("id");
      const firstId = requestedId && chatItems.some((chat) => chat.id === requestedId) ? requestedId : chatItems[0]?.id;
      setWorkspaceId(chatItems.find((chat) => chat.id === firstId)?.workspaceId || workspaceItems[0]?.id || "");
      if (firstId) void loadChat(firstId).catch((err) => setError(err instanceof Error ? err.message : "Could not load chat."));
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load chat data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadChat]);

  const selectedProvider = providers.find((provider) => provider.id === providerId);
  const shouldAutoAnalyze = !providerId || selectedProvider?.provider === "ollama";
  const selectableProviders = providers.filter((provider) => externalAiEnabled || provider.provider === "ollama");
  const estimatedChatCost = selectedProvider?.defaultModel === modelName && selectedProvider.inputPricePerMillion != null && selectedProvider.outputPricePerMillion != null
    ? ((Math.ceil(prompt.trim().length / 4) * selectedProvider.inputPricePerMillion + 512 * selectedProvider.outputPricePerMillion) / 1_000_000)
    : null;
  const cheapestConfiguredProvider = [
    ...selectableProviders
      .filter((provider) => provider.provider !== "ollama" && provider.defaultModel && provider.inputPricePerMillion != null && provider.outputPricePerMillion != null)
      .map((provider) => ({ provider, modelName: provider.defaultModel!, cost: (Math.ceil(prompt.trim().length / 4) * provider.inputPricePerMillion! + 512 * provider.outputPricePerMillion!) / 1_000_000 })),
    ...models.map((model) => ({ provider: { id: "", displayName: "Local Ollama" }, modelName: model.name, cost: 0 })),
    ].sort((left, right) => left.cost - right.cost || Number(Boolean(left.provider.id)) - Number(Boolean(right.provider.id)))[0];
  const taskRecommendation = (() => {
    const text = prompt.toLowerCase();
    if (!text.trim()) return null;
    const task = /\b(lowest cost|cheapest|cheap|affordable|low cost|budget)\b/.test(text) ? "lowest cost"
      : /\b(code|coding|debug|program|software|sql|script|function)\b/.test(text) ? "coding"
      : /\b(math|mathemat|equation|calculate|proof|algebra)\b/.test(text) ? "math"
      : /\b(research|compare|sources|summarize|long document|literature)\b/.test(text) ? "research"
      : /\b(write|writing|draft|story|email|blog|rewrite)\b/.test(text) ? "writing"
      : /\b(long context|large document|huge document|entire book|many documents)\b/.test(text) ? "long context"
      : /\b(fast|quick|low latency|speed)\b/.test(text) ? "speed"
      : /\b(image|photo|picture|visual|screenshot)\b/.test(text) ? "image analysis" : "general";
    const fits: Record<string, string[]> = {
      coding: ["deepseek", "anthropic", "claude", "openai", "gpt"],
      math: ["deepseek", "openai", "gpt"],
      research: ["gemini", "google", "openai", "gpt", "openrouter"],
      writing: ["anthropic", "claude", "openai", "gpt"],
      "image analysis": ["vision", "gemini", "gpt-4o", "claude-3"],
      "long context": ["gemini", "long context", "context"],
      speed: [],
      "lowest cost": [],
      general: [],
    };
    const candidates = [
      ...selectableProviders.filter((item) => item.defaultModel).map((item) => ({ providerId: item.id, provider: item.displayName, family: `${item.provider} ${item.defaultModel} ${item.strengths || ""}`.toLowerCase(), modelName: item.defaultModel!, rate: item.provider === "ollama" ? 0 : item.inputPricePerMillion != null && item.outputPricePerMillion != null ? item.inputPricePerMillion + item.outputPricePerMillion : Number.POSITIVE_INFINITY, speed: item.averageResponseMs ?? Number.POSITIVE_INFINITY, context: item.contextLength ?? 0 })),
      ...models.map((item) => ({ providerId: "", provider: "Local Ollama", family: item.name.toLowerCase(), modelName: item.name, rate: 0, speed: Number.POSITIVE_INFINITY, context: 0 })),
    ];
    if (!candidates.length) return null;
    const ranked = candidates.map((candidate) => {
      const preference = fits[task].findIndex((term) => candidate.family.includes(term));
      return { ...candidate, fit: preference < 0 ? 0 : fits[task].length - preference };
    });
    const bestFit = Math.max(...ranked.map((item) => item.fit));
    const shortlist = bestFit > 0 ? ranked.filter((item) => item.fit === bestFit) : ranked;
    shortlist.sort((a, b) => task === "speed" ? a.speed - b.speed || a.provider.localeCompare(b.provider) : task === "long context" ? b.context - a.context || a.rate - b.rate : a.rate - b.rate || a.provider.localeCompare(b.provider));
    const best = shortlist[0];
    const reason = task === "lowest cost" && best.provider === "Local Ollama" ? "Local Ollama has $0 provider API cost and uses your computer's hardware."
      : task === "lowest cost" && best.rate < Number.POSITIVE_INFINITY ? "Lowest configured input plus output rate per million tokens among your connected default models."
      : task === "speed" && best.speed < Number.POSITIVE_INFINITY ? `Lowest observed average response time (${(best.speed / 1000).toFixed(1)}s) among your configured providers.`
      : task === "long context" && best.context ? `Largest configured context window (${best.context.toLocaleString()} tokens) among your connected default models.`
      : bestFit > 0 ? `The ${task} task matches configured model names or your capability notes.`
      : `No configured model matched a ${task} family heuristic, so this is a general fallback.`;
    return { ...best, task, reason };
  })();
  const selectedJudgeProvider = providers.find((provider) => provider.id === judgeProviderId);
  const availableModels = providerId ? [] : models;
  const workspaceChats = chats.filter((chat) => chat.workspaceId === workspaceId);
  const messageGroups = messages.reduce<Message[][]>((groups, message) => {
    if (message.role === "user" || groups.length === 0) groups.push([message]);
    else groups[groups.length - 1].push(message);
    return groups;
  }, []);

  function addCompareTarget() {
    if (compareTargets.length >= 3) return;
    const defaultProvider = selectableProviders[0];
    const defaultModel = models.find((model) => model.name !== modelName)?.name || defaultProvider?.defaultModel || "";
    setCompareTargets((current) => [...current, { key: Date.now(), providerId: defaultModel && models.some((model) => model.name === defaultModel) ? "" : defaultProvider?.id || "", modelName: defaultModel }]);
  }

  function updateCompareTarget(key: number, update: Partial<Pick<CompareTarget, "providerId" | "modelName">>) {
    setCompareTargets((current) => current.map((target) => target.key === key ? { ...target, ...update } : target));
  }

  async function createChat() {
    setError("");
    try {
      const chat = await requestJson<ChatSummary>("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
      setChats((current) => [chat, ...current]); setChatId(chat.id); setMessages([]); setMemoryEnabled(chat.memoryEnabled); window.history.replaceState(null, "", `/chat?id=${encodeURIComponent(chat.id)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create chat."); }
  }

  async function createWorkspace() {
    const name = window.prompt("Name this workspace (for example, Research or Coding):")?.trim();
    if (!name) return;
    try {
      const created = await requestJson<Workspace>("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setWorkspaces((current) => [...current, created]); setWorkspaceId(created.id); setChatId(""); setMessages([]); setModelName(""); setProviderId("");
      window.history.replaceState(null, "", "/chat");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create workspace."); }
  }

  async function editWorkspaceInstructions() {
    const selected = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!selected) return;
    const systemPrompt = window.prompt(`Instructions for ${selected.name} (leave blank for none):`, selected.systemPrompt || "");
    if (systemPrompt === null) return;
    try {
      const updated = await requestJson<Workspace>(`/api/workspaces/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemPrompt }) });
      setWorkspaces((current) => current.map((workspace) => workspace.id === updated.id ? updated : workspace));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save workspace instructions."); }
  }

  function switchWorkspace(id: string) {
    setWorkspaceId(id); setChatId(""); setMessages([]); setModelName(""); setProviderId("");
    window.history.replaceState(null, "", "/chat");
  }

  async function deleteChat(id: string) {
    if (!window.confirm("Delete this conversation and its messages?")) return;
    try {
      const response = await apiFetch(`${API_URL}/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete chat.");
      const remaining = chats.filter((chat) => chat.id !== id); setChats(remaining);
      if (chatId === id) { setChatId(""); setMessages([]); if (remaining[0]) await loadChat(remaining[0].id); }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete chat."); }
  }

  async function toggleMemory() {
    if (!chatId) return;
    const next = !memoryEnabled;
    try {
      await requestJson(`/api/chats/${encodeURIComponent(chatId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memoryEnabled: next }) });
      setMemoryEnabled(next);
      setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, memoryEnabled: next } : chat));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update memory setting."); }
  }

  async function clearMemory() {
    if (!chatId || !window.confirm("Clear all saved messages in this chat? The chat itself will remain.")) return;
    try {
      const response = await apiFetch(`${API_URL}/api/chats/${encodeURIComponent(chatId)}/messages`, { method: "DELETE" });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Could not clear chat messages."); }
      setMessages([]);
      setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, title: "New chat", modelName: null, _count: { messages: 0 } } : chat));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not clear chat messages."); }
  }

  function exportConversation(format: "md" | "txt") {
    if (!messages.length) return;
    const title = chats.find((chat) => chat.id === chatId)?.title || "AI Studio conversation";
    const lines = [`# ${title}`, "", `Exported ${new Date().toLocaleString()}`, ""];
    for (const message of messages) {
      if (message.role === "user") {
        lines.push(format === "md" ? "## You" : "You", "", message.content || "", "");
      } else if (message.modelName?.startsWith("AI Judge (")) {
        const evaluation = parseEvaluation(message.content);
        lines.push(format === "md" ? `## ${message.modelName}` : message.modelName, "");
        if (evaluation) {
          lines.push(`Winner: ${evaluation.winner}`, `Accuracy: ${evaluation.accuracy}/5`, `Creativity: ${evaluation.creativity}/5`, `Helpfulness: ${evaluation.helpfulness}/5`, `Hallucination risk: ${evaluation.hallucinationRisk}/5`, `Rationale: ${evaluation.rationale}`, "");
        } else lines.push(message.content || "", "");
      } else {
        const heading = `${message.modelName || "Assistant"}${message.status === "failed" ? " (failed)" : ""}`;
        lines.push(format === "md" ? `## ${heading}` : heading, "", message.content || "", "");
      }
    }
    const safeName = title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "conversation";
    const blob = new Blob([lines.join("\n")], { type: format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${safeName}.${format}`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || !modelName.trim() || sending || (editingMessageId && compareMode) || (compareMode && (compareTargets.length < 1 || compareTargets.some((target) => !target.modelName.trim()))) || (debateMode && (!judgeModelName.trim() || (judgeProviderId === "" && models.length > 0 && !models.some((model) => model.name === judgeModelName))))) return;
    setSending(true); setError("");
    try {
      let activeChatId = chatId;
      if (!activeChatId) {
        const created = await requestJson<ChatSummary>("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
        activeChatId = created.id; setChatId(activeChatId); setChats((current) => [created, ...current]);
      }
      const userText = prompt.trim(); setPrompt(""); setImprovedPrompt("");
      if (editingMessageId) {
        const editId = editingMessageId;
        const payload = await requestJson<{ userMessage: Message; title: string }>(`/api/chats/${encodeURIComponent(activeChatId)}/messages/${encodeURIComponent(editId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: userText }) });
        const position = messages.findIndex((message) => message.id === editId);
        const nextMessages = [...messages.slice(0, position), payload.userMessage];
        setMessages(nextMessages);
        setEditingMessageId("");
        const retry = await requestJson<{ assistantMessage: Message }>(`/api/chats/${encodeURIComponent(activeChatId)}/messages/${encodeURIComponent(editId)}/retry`, { method: "POST" });
        setMessages([...nextMessages, retry.assistantMessage]);
        if (shouldAutoAnalyze && retry.assistantMessage.status === "completed") void analyzeResponse(retry.assistantMessage.id, activeChatId, editId);
        setChats((current) => current.map((chat) => chat.id === activeChatId ? { ...chat, title: payload.title, updatedAt: new Date().toISOString() } : chat));
        setEditingMessageId("");
      } else if (compareMode) {
        const targets = [{ providerConnectionId: providerId || null, modelName: modelName.trim() }, ...compareTargets.map((target) => ({ providerConnectionId: target.providerId || null, modelName: target.modelName.trim() }))];
        const payload = await requestJson<{ userMessage: Message; assistantMessages: Message[]; title: string }>(`/api/chats/${encodeURIComponent(activeChatId)}/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: userText, targets, ...(debateMode ? { judgeTarget: { providerConnectionId: judgeProviderId || null, modelName: judgeModelName.trim() } } : {}) }) });
        setMessages((current) => [...current, payload.userMessage, ...payload.assistantMessages]);
        setChats((current) => [{ id: activeChatId, title: payload.title, memoryEnabled, workspaceId, modelName: targets.map((target) => target.modelName).join(", ").slice(0, 120), updatedAt: new Date().toISOString(), _count: { messages: (current.find((chat) => chat.id === activeChatId)?._count?.messages ?? 0) + targets.length + 1 } }, ...current.filter((chat) => chat.id !== activeChatId)]);
      } else {
        const controller = new AbortController();
        generationController.current = controller;
        let streamMessageId = "";
        let streamUserMessageId = "";
        let streamCompleted = false;
        await streamChat(`/api/chats/${encodeURIComponent(activeChatId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: userText, modelName: modelName.trim(), providerConnectionId: providerId || null }), signal: controller.signal }, (event) => {
          if (event.type === "meta") {
            const userMessage = event.userMessage;
            const assistantMessage = event.assistantMessage;
            if (!assistantMessage || !userMessage) return;
            streamMessageId = assistantMessage.id;
            streamUserMessageId = userMessage.id;
            setMessages((current) => [...current, userMessage, assistantMessage]);
            setChats((current) => [{ id: activeChatId, title: event.title || "New chat", memoryEnabled, workspaceId, modelName: modelName.trim(), updatedAt: new Date().toISOString(), _count: { messages: (current.find((chat) => chat.id === activeChatId)?._count?.messages ?? 0) + 2 } }, ...current.filter((chat) => chat.id !== activeChatId)]);
          } else if (event.type === "token" && streamMessageId && event.token) {
            setMessages((current) => current.map((message) => message.id === streamMessageId ? { ...message, content: `${message.content || ""}${event.token}` } : message));
          } else if ((event.type === "done" || event.type === "error") && event.assistantMessage) {
            const assistantMessage = event.assistantMessage;
            if (event.type === "done" && assistantMessage.status === "completed") streamCompleted = true;
            setMessages((current) => current.map((message) => message.id === assistantMessage.id ? assistantMessage : message));
            if (event.type === "error") setError(event.error || "The model request failed.");
          }
        });
        if (streamCompleted && streamMessageId && shouldAutoAnalyze) void analyzeResponse(streamMessageId, activeChatId, streamUserMessageId);
      }
      window.history.replaceState(null, "", `/chat?id=${encodeURIComponent(activeChatId)}`);
    } catch (err) { setError(err instanceof DOMException && err.name === "AbortError" ? "Generation stopped. Refresh this conversation to see its saved status." : err instanceof Error ? err.message : "Could not send message."); }
    finally { generationController.current = null; setSending(false); void loadChats().catch(() => undefined); }
  }

  function stopGeneration() {
    generationController.current?.abort();
  }

  async function retryResponse(userMessageId: string, response: Message) {
    if (!chatId || retryingMessageId) return;
    setRetryingMessageId(response.id); setError("");
    try {
      const payload = await requestJson<{ assistantMessage: Message }>(`/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(userMessageId)}/retry`, { method: "POST" });
      setMessages((current) => [...current, payload.assistantMessage]);
      if (shouldAutoAnalyze && payload.assistantMessage.status === "completed") void analyzeResponse(payload.assistantMessage.id, chatId, userMessageId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not retry this response."); }
    finally { setRetryingMessageId(""); }
  }

  async function analyzeResponse(messageId: string, targetChatId = chatId, userMessageId?: string) {
    if (!targetChatId || analyzingMessageId) return;
    setAnalyzingMessageId(messageId); setError("");
    try {
      const result = await requestJson<{ qualityMessage: Message }>(`/api/chats/${encodeURIComponent(targetChatId)}/messages/${encodeURIComponent(messageId)}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userMessageId }) });
      setMessages((current) => [...current, result.qualityMessage]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not analyze this response."); }
    finally { setAnalyzingMessageId(""); }
  }

  async function improvePrompt() {
    if (!prompt.trim() || improvingPrompt || !models.length) return;
    setImprovingPrompt(true);
    setError("");
    setImprovedPrompt("");
    try {
      const result = await requestJson<{ improvedPrompt: string }>("/api/prompts/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model: models[0].name }),
      });
      setImprovedPrompt(result.improvedPrompt);
      showToast("Prompt suggestion is ready.", "success");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not improve this prompt.", "error");
      setError(reason instanceof Error ? reason.message : "Could not improve this prompt.");
    } finally {
      setImprovingPrompt(false);
    }
  }

  return <main className="min-h-screen bg-[#0b0d12] px-4 py-5 text-slate-100 md:px-8 print:bg-white print:text-black"><div className="mx-auto max-w-7xl"><div className="flex items-center justify-between print:hidden"><Link href="/" className="text-sm text-violet-300 hover:text-violet-200">← Dashboard</Link><div className="flex gap-4"><Link href="/search" className="text-sm text-violet-300 hover:text-violet-200">Search</Link><Link href="/documents" className="text-sm text-violet-300 hover:text-violet-200">Documents</Link><Link href="/providers" className="text-sm text-violet-300 hover:text-violet-200">Manage providers</Link></div></div><header className="flex flex-wrap items-end justify-between gap-4 py-6 print:hidden"><div><p className="text-sm uppercase tracking-widest text-violet-300">AI Experiment Studio</p><h1 className="mt-2 text-3xl font-semibold">Chat</h1><p className="mt-2 text-sm text-slate-400">Saved conversations with local Ollama or your connected AI providers.</p>{!externalAiEnabled && <p className="mt-2 text-xs text-emerald-300">Free local mode: AI inference stays on your Ollama server; external API providers are disabled.</p>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={!messages.length} onClick={() => exportConversation("md")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40">Export Markdown</button><button type="button" disabled={!messages.length} onClick={() => exportConversation("txt")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40">Export TXT</button><button type="button" disabled={!messages.length} onClick={() => window.print()} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium hover:bg-violet-500 disabled:opacity-40">Print / Save PDF</button></div></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{error}</p>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl print:hidden border border-white/10 bg-white/[0.03] px-4 py-3"><div><p className="text-sm font-medium">Conversation memory</p><p className="mt-1 text-xs text-slate-500">{memoryEnabled ? "Earlier messages are included as context for replies." : "Earlier messages stay saved but are not sent as context."}</p></div><div className="flex gap-2"><button type="button" disabled={!chatId} onClick={() => void toggleMemory()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40">{memoryEnabled ? "Turn memory off" : "Turn memory on"}</button><button type="button" disabled={!chatId || !messages.length} onClick={() => void clearMemory()} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-400/5 disabled:opacity-40">Clear messages</button></div></div>
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[280px_1fr] print:block"><aside className="rounded-xl border border-white/10 bg-white/[0.03] p-3 print:hidden"><label className="px-2 text-xs text-slate-400">Workspace<select value={workspaceId} onChange={(event) => switchWorkspace(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-slate-100">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => void createWorkspace()} className="rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-300 hover:bg-white/5">+ Workspace</button><button type="button" onClick={() => void editWorkspaceInstructions()} className="rounded-lg border border-white/10 px-2 py-2 text-xs text-slate-300 hover:bg-white/5">Instructions</button></div><button type="button" onClick={() => void createChat()} className="mt-2 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium hover:bg-violet-500">+ New chat</button><h2 className="px-2 pb-2 pt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">History</h2>{loading ? <div role="status" aria-label="Loading conversations" className="space-y-3 p-2"><LoadingSkeleton className="h-10 w-full" /><LoadingSkeleton className="h-10 w-4/5" /><LoadingSkeleton className="h-10 w-11/12" /></div> : workspaceChats.length ? <ul className="space-y-1">{workspaceChats.map((chat) => <li key={chat.id} className={`group flex items-center gap-1 rounded-lg ${chat.id === chatId ? "bg-white/10" : "hover:bg-white/5"}`}><button type="button" onClick={() => { void loadChat(chat.id).then(() => window.history.replaceState(null, "", `/chat?id=${encodeURIComponent(chat.id)}`)); }} className="min-w-0 flex-1 px-3 py-2.5 text-left"><span className="block truncate text-sm">{chat.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{chat.modelName || "New conversation"}</span></button><button type="button" title="Delete conversation" onClick={() => void deleteChat(chat.id)} className="px-2 text-slate-500 opacity-70 hover:text-red-300">×</button></li>)}</ul> : <p className="p-2 text-sm text-slate-500">No saved chats yet.</p>}</aside>
      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] print:block print:min-h-0 print:overflow-visible print:border-0 print:bg-white"><div className="space-y-3 border-b border-white/10 p-4 print:hidden"><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-400">Provider<select value={providerId} onChange={(event) => { const value = event.target.value; setProviderId(value); const item = providers.find((provider) => provider.id === value); setModelName(item?.defaultModel || ""); }} className="mt-1 block rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-slate-100"><option value="">Local Ollama</option>{selectableProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName} ({provider.provider})</option>)}</select></label><label className="min-w-48 flex-1 text-xs text-slate-400">Model{!providerId && models.length ? <select value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-slate-100"><option value="">Select an installed model</option>{availableModels.map((model) => <option key={model.name} value={model.name}>{model.name}{model.responseSamples ? ` · avg ${(model.averageResponseMs! / 1000).toFixed(1)}s` : ""}</option>)}</select> : <input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder={selectedProvider?.defaultModel || "Enter model name"} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 text-sm text-slate-100" />}</label><button type="button" onClick={() => { if (compareMode) { setCompareMode(false); setDebateMode(false); } else { setCompareMode(true); if (!compareTargets.length) addCompareTarget(); } }} className={`rounded-lg border px-3 py-2 text-sm ${compareMode ? "border-violet-400/50 bg-violet-400/10 text-violet-200" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>{compareMode ? "Comparison on" : "Compare models"}</button></div>{compareMode && <div className="space-y-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.04] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-400">Add up to three more models</p><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={debateMode} onChange={(event) => { const enabled = event.target.checked; setDebateMode(enabled); if (enabled && !judgeModelName) { const local = models.find((item) => item.name !== modelName && !compareTargets.some((target) => target.modelName === item.name)); if (local) { setJudgeProviderId(""); setJudgeModelName(local.name); } else if (selectableProviders[0]) { setJudgeProviderId(selectableProviders[0].id); setJudgeModelName(selectableProviders[0].defaultModel || ""); } } }} />AI Debate judge</label><button type="button" disabled={compareTargets.length >= 3} onClick={addCompareTarget} className="text-xs text-violet-300 disabled:opacity-40">+ Add model</button></div></div>{compareTargets.map((target, index) => { const provider = providers.find((item) => item.id === target.providerId); return <div key={target.key} className="flex flex-wrap items-end gap-2"><label className="text-xs text-slate-400">Model {index + 2}<select value={target.providerId} onChange={(event) => { const id = event.target.value; updateCompareTarget(target.key, { providerId: id, modelName: providers.find((item) => item.id === id)?.defaultModel || "" }); }} className="mt-1 block rounded-lg border border-white/10 bg-[#15171d] px-2 py-2 text-sm text-slate-100"><option value="">Local Ollama</option>{selectableProviders.map((item) => <option key={item.id} value={item.id}>{item.displayName} ({item.provider})</option>)}</select></label>{!target.providerId && models.length ? <label className="min-w-40 flex-1 text-xs text-slate-400">Installed model<select value={target.modelName} onChange={(event) => updateCompareTarget(target.key, { modelName: event.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-2 py-2 text-sm text-slate-100"><option value="">Select a model</option>{models.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label> : <label className="min-w-40 flex-1 text-xs text-slate-400">Model name<input value={target.modelName} onChange={(event) => updateCompareTarget(target.key, { modelName: event.target.value })} placeholder={provider?.defaultModel || "Enter model name"} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-2 py-2 text-sm text-slate-100" /></label>}<button type="button" onClick={() => setCompareTargets((current) => current.filter((item) => item.key !== target.key))} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-red-300">Remove</button></div>; })}{debateMode && <div className="flex flex-wrap items-end gap-2 border-t border-white/10 pt-3"><p className="w-full text-xs text-slate-400">The judge receives candidate responses and returns a comparative assessment.</p><label className="text-xs text-slate-400">Judge provider<select value={judgeProviderId} onChange={(event) => { const id = event.target.value; setJudgeProviderId(id); setJudgeModelName(providers.find((item) => item.id === id)?.defaultModel || ""); }} className="mt-1 block rounded-lg border border-white/10 bg-[#15171d] px-2 py-2 text-sm text-slate-100"><option value="">Local Ollama</option>{selectableProviders.map((item) => <option key={item.id} value={item.id}>{item.displayName} ({item.provider})</option>)}</select></label>{!judgeProviderId && models.length ? <label className="min-w-40 flex-1 text-xs text-slate-400">Judge model<select value={judgeModelName} onChange={(event) => setJudgeModelName(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-2 py-2 text-sm text-slate-100"><option value="">Select a model</option>{models.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label> : <label className="min-w-40 flex-1 text-xs text-slate-400">Judge model<input value={judgeModelName} onChange={(event) => setJudgeModelName(event.target.value)} placeholder={selectedJudgeProvider?.defaultModel || "Enter judge model name"} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#15171d] px-2 py-2 text-sm text-slate-100" /></label>}</div>}</div>}</div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6 print:block print:overflow-visible print:p-0"><h1 className="hidden pb-5 text-2xl font-semibold print:block">{chats.find((chat) => chat.id === chatId)?.title || "AI Studio conversation"}</h1>{!messages.length && <div className="mx-auto mt-20 max-w-md text-center"><h2 className="text-xl font-medium">What would you like to explore?</h2><p className="mt-2 text-sm text-slate-400">Choose a provider and model, then ask a question. Your conversation is saved automatically.</p></div>}{messageGroups.map((group) => { const userMessage = group[0]?.role === "user" ? group[0] : null; const answers = userMessage ? group.slice(1) : group; return <div key={group[0].id} className="space-y-3">{userMessage && <article className="ml-auto max-w-3xl rounded-xl bg-violet-600/20 p-4"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-300">You</p><div className="text-sm leading-6"><MathMarkdown content={userMessage.content || ""} /></div>{!chats.find((chat) => chat.id === chatId)?.modelName?.includes(",") && <button type="button" onClick={() => { setEditingMessageId(userMessage.id); setPrompt(userMessage.content || ""); }} className="mt-3 text-xs text-violet-300 hover:text-violet-200">Edit &amp; regenerate</button>}</article>}<div className={`grid grid-cols-1 gap-3 ${answers.length > 1 ? "xl:grid-cols-2" : ""}`}>{answers.map((message) => { const isEvaluation = message.modelName?.startsWith("AI Judge (") || message.modelName?.startsWith("AI Quality ("); const evaluation = isEvaluation ? parseEvaluation(message.content) : null; const singleModelChat = chats.find((chat) => chat.id === chatId)?.modelName === message.modelName; return <article key={message.id} className={`mr-auto w-full rounded-xl border p-4 ${evaluation ? "border-amber-300/30 bg-amber-300/[0.04] xl:col-span-2" : "border-white/10 bg-black/20"}`}><div className="mb-2 flex items-center justify-between gap-3"><p className="truncate text-xs font-medium uppercase tracking-wide text-violet-300">{message.modelName || "Assistant"}{message.status === "failed" ? " · failed" : ""}</p>{message.durationMs != null && <span className="shrink-0 text-[11px] text-slate-500">{(message.durationMs / 1000).toFixed(1)}s</span>}{message.estimatedCostUsd != null && <span className="shrink-0 text-[11px] text-slate-500">~${message.estimatedCostUsd.toFixed(6)}</span>}{message.content && <span className="shrink-0 text-[11px] text-slate-500" title="Approximate output token count based on response length">~{Math.ceil(message.content.length / 4)} estimated tokens</span>}</div>{evaluation ? <><div className="flex flex-wrap items-center gap-3"><p className="text-lg font-semibold text-amber-200">{message.modelName?.startsWith("AI Quality (") ? "Quality analysis" : `Winner: ${evaluation.winner}`}</p><span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-xs text-amber-100">AI-generated assessment</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(message.modelName?.startsWith("AI Quality (") ? [["Quality", evaluation.quality], ["Accuracy", evaluation.accuracy], ["Readability", evaluation.readability], ["Confidence", evaluation.confidence], ["Technical depth", evaluation.technicalDepth], ["Hallucination risk", evaluation.hallucinationRisk]] : [["Accuracy", evaluation.accuracy], ["Creativity", evaluation.creativity], ["Helpfulness", evaluation.helpfulness], ["Confidence", evaluation.confidence], ["Hallucination risk", evaluation.hallucinationRisk]]).map(([label, score]) => <div key={label} className="rounded-lg bg-black/20 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-semibold">{score}/5</p><div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10"><div className={`h-full rounded ${label === "Hallucination risk" ? "bg-rose-400" : "bg-violet-400"}`} style={{ width: `${Number(score) * 20}%` }} /></div></div>)}</div><p className="mt-3 text-sm leading-6 text-slate-300">{evaluation.rationale}</p><p className="mt-2 text-xs text-slate-500">Scores are the selected model’s assessment, not verified ground truth.</p></> : <div className="min-w-0 break-words text-sm leading-6 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h1]:my-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400/40 [&_blockquote]:pl-4 [&_blockquote]:text-slate-400 [&_table]:my-3 [&_table]:w-full [&_th]:border [&_th]:border-white/15 [&_th]:bg-white/5 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_a]:text-violet-300 [&_a]:underline"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ pre: MarkdownPre, code: ({ className, children }) => <code className={className ? `${className} font-mono` : "rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]"}>{children}</code>, a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{normalizeBareMath(message.content || (message.status === "running" ? "Generating response…" : ""))}</ReactMarkdown>{message.sources && message.sources.length > 0 && (<p className="mt-3 border-t border-white/10 pt-2 text-xs text-slate-500">Workspace context: {message.sources.map((source) => source.name).join(", ")}</p>)}{userMessage && singleModelChat && message.status === "completed" && !evaluation && !answers.some((item) => item.modelName?.startsWith("AI Quality (")) && <button type="button" disabled={analyzingMessageId === message.id || sending} title="Runs the selected model again and may add usage." onClick={() => void analyzeResponse(message.id, chatId, userMessage.id)} className="mt-3 mr-3 border-t border-white/10 pt-2 text-xs text-amber-200 hover:text-amber-100 disabled:opacity-50">{analyzingMessageId === message.id ? "Analyzing…" : "Analyze quality"}</button>}{userMessage && singleModelChat && <button type="button" disabled={retryingMessageId === message.id || sending} onClick={() => void retryResponse(userMessage.id, message)} className="mt-3 border-t border-white/10 pt-2 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-50">{retryingMessageId === message.id ? "Generating…" : message.status === "failed" ? "Retry response" : "Regenerate response"}</button>}</div>}</article>; })}</div></div>; })}{sending && <p className="text-sm text-slate-500">Generating response…</p>}</div>
      <form onSubmit={sendMessage} className="border-t border-white/10 p-4 print:hidden">{taskRecommendation && <div className="mb-3 rounded-lg border border-violet-400/20 bg-violet-400/5 p-3 text-xs text-violet-100"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong>Suggested for {taskRecommendation.task}:</strong> {taskRecommendation.modelName} via {taskRecommendation.provider}</span><button type="button" onClick={() => { setProviderId(taskRecommendation.providerId); setModelName(taskRecommendation.modelName); }} className="rounded border border-violet-300/30 px-2 py-1 underline">Use this model</button></div><p className="mt-2 text-violet-200/70">{taskRecommendation.reason} This is a capability and history based suggestion, not a live benchmark.</p></div>}{prompt.trim() && cheapestConfiguredProvider && (cheapestConfiguredProvider.provider.id !== providerId || cheapestConfiguredProvider.modelName !== modelName) && <p className="mb-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-200">Lowest estimate: {cheapestConfiguredProvider.provider.displayName} ({cheapestConfiguredProvider.modelName}) at about ${cheapestConfiguredProvider.cost.toFixed(6)} for this prompt. <button type="button" onClick={() => { setProviderId(cheapestConfiguredProvider.provider.id); setModelName(cheapestConfiguredProvider.modelName); }} className="ml-2 underline">Use this model</button></p>}{editingMessageId && <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-violet-400/20 bg-violet-400/5 p-3 text-xs text-violet-200"><span>Editing this prompt will remove its later replies and generate a new one.</span><button type="button" onClick={() => { setEditingMessageId(""); setPrompt(""); }} className="underline">Cancel edit</button></div>}{improvedPrompt && <div className="mb-3 rounded-lg border border-violet-400/20 bg-violet-400/5 p-3"><p className="text-xs font-medium text-violet-200">Suggested prompt</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{improvedPrompt}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setPrompt(improvedPrompt); setImprovedPrompt(""); }} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium">Use suggestion</button><button type="button" onClick={() => setImprovedPrompt("")} className="rounded-md border border-white/10 px-3 py-1.5 text-xs">Dismiss</button></div></div>}<label htmlFor="chat-prompt" className="sr-only">Message</label><div className="flex items-end gap-3"><textarea id="chat-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setImprovedPrompt(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={10000} rows={3} placeholder={editingMessageId ? "Edit the prompt…" : "Message… (Enter to send, Shift+Enter for a new line)"} className="min-h-20 flex-1 resize-y rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-violet-400" /><button type="button" disabled={improvingPrompt || !prompt.trim() || !models.length || sending} onClick={() => void improvePrompt()} title={!models.length ? "Start Ollama and install a model to improve prompts" : "Improve this prompt with your local Ollama model"} className="rounded-lg border border-violet-400/20 px-3 py-3 text-xs text-violet-200 hover:bg-violet-400/5 disabled:cursor-not-allowed disabled:opacity-50">{improvingPrompt ? "Improving..." : "Improve prompt"}</button><button type="submit" disabled={sending || !prompt.trim() || !modelName.trim()} className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending…" : editingMessageId ? "Update & regenerate" : "Send"}</button>{sending && !compareMode && <button type="button" onClick={stopGeneration} className="rounded-lg border border-red-400/30 px-4 py-3 text-sm text-red-300 hover:bg-red-400/5">Stop</button>}</div><p className="mt-2 text-xs text-slate-500">{estimatedChatCost == null ? (providerId === "" || selectedProvider?.provider === "ollama" ? "Local Ollama: $0 provider API cost (uses your computer)." : "Configure input and output rates under Manage providers to see a cost estimate.") : `Approximate cost: $${estimatedChatCost.toFixed(6)} (assumes 512 output tokens; actual usage can vary).`} Responses are stored in your account history. Do not send sensitive information. {shouldAutoAnalyze && "A free local quality score is added after each completed Ollama response; this uses extra time on your computer."}</p></form></section></div></div></main>;
}
