"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/store/agent-builder";
import { useAccount } from "wagmi";
import {
  Bot,
  Send,
  X,
  Plus,
  ArrowRight,
  Settings,
  Trash2,
  CircleHelp,
  Loader2,
  Zap,
  Sparkles,
  TrendingUp,
  Repeat2,
  Bell,
  Activity,
  ArrowUpRight,
  KeyRound,
} from "lucide-react";
import clsx from "clsx";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TextMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  isThinking?: boolean; // streaming but not yet done — shows thinking style
}

interface ToolCallMessage {
  id: string;
  role: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
}

interface AskUserMessage {
  id: string;
  role: "ask_user";
  question: string;
  answered?: string;
}

type Message = TextMessage | ToolCallMessage | AskUserMessage;

interface ApiMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }[];
}

const WELCOME_MESSAGE =
  "Hi! I'm your **Omega bot builder agent**.\n\nTell me what HashKey Chain trading strategy you want and I'll build it on the canvas.\n\n*For example: \"Build a BTC momentum tracker that marks the chart when price rises\"*";

// Starter prompts — one click builds the strategy on the canvas
const QUICK_PROMPTS: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  prompt: string;
}[] = [
  {
    icon: TrendingUp,
    label: "Momentum tracker",
    desc: "Mark the chart on BTC upmoves",
    prompt:
      "Build a BTC momentum tracker that marks the chart when price rises",
  },
  {
    icon: Repeat2,
    label: "DCA bot",
    desc: "Buy WHSK every hour",
    prompt: "Create a DCA bot that buys WHSK every hour",
  },
  {
    icon: Bell,
    label: "Price alert",
    desc: "Notify on a 5% ETH drop",
    prompt: "Alert me when ETH drops 5% within an hour",
  },
  {
    icon: Activity,
    label: "MA crossover",
    desc: "Classic MA-cross signal",
    prompt: "Make a moving-average crossover strategy for BTC",
  },
];

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading ## / ###
    if (line.startsWith("### ")) {
      result.push(
        <p key={i} className="text-white font-semibold text-[11px] mt-2 mb-0.5">
          {inlineMarkdown(line.slice(4))}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      result.push(
        <p key={i} className="text-white font-semibold text-xs mt-2.5 mb-1">
          {inlineMarkdown(line.slice(3))}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      result.push(
        <p key={i} className="text-white font-bold text-xs mt-2.5 mb-1">
          {inlineMarkdown(line.slice(2))}
        </p>,
      );
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[-*] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      result.push(
        <ul key={`ul_${i}`} className="space-y-0.5 my-1 pl-1">
          {items.map((item, j) => (
            <li
              key={j}
              className="flex gap-1.5 text-[11px] text-white/80 leading-relaxed"
            >
              <span className="text-purple-400 mt-px shrink-0">•</span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      result.push(
        <ol key={`ol_${i}`} className="space-y-0.5 my-1 pl-1">
          {items.map((item, j) => (
            <li
              key={j}
              className="flex gap-1.5 text-[11px] text-white/80 leading-relaxed"
            >
              <span className="text-purple-400 shrink-0 font-mono text-[10px] mt-px">
                {j + 1}.
              </span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>,
      );
      num;
      continue;
    }

    // Empty line → spacer
    if (line.trim() === "") {
      result.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    // Regular paragraph
    result.push(
      <p key={i} className="text-[11px] text-white/85 leading-relaxed">
        {inlineMarkdown(line)}
      </p>,
    );
    i++;
  }

  return result;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Process **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="text-white/70 not-italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-white/10 text-purple-300 px-1 py-0.5 rounded text-[10px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ─── Tool call metadata ───────────────────────────────────────────────────────

const TOOL_META: Record<
  string,
  {
    icon: React.ReactNode;
    color: string;
    label: (args: Record<string, unknown>) => string;
    verb: string;
  }
> = {
  add_node: {
    icon: <Plus size={10} />,
    color: "text-emerald-400 border-emerald-500/25 bg-emerald-950/30",
    label: (a) => `${String(a.type ?? "").replace(/_/g, " ")}`,
    verb: "Placing",
  },
  connect_nodes: {
    icon: <ArrowRight size={10} />,
    color: "text-sky-400 border-sky-500/25 bg-sky-950/30",
    label: (a) =>
      `${String(a.sourceHandle ?? "")} → ${String(a.targetHandle ?? "")}`,
    verb: "Connecting",
  },
  configure_node: {
    icon: <Settings size={10} />,
    color: "text-amber-400 border-amber-500/25 bg-amber-950/30",
    label: (a) => `${String(a.nodeId ?? "")}`,
    verb: "Configuring",
  },
  ask_user: {
    icon: <CircleHelp size={10} />,
    color: "text-purple-400 border-purple-500/25 bg-purple-950/30",
    label: () => "clarification",
    verb: "Asking for",
  },
  clear_canvas: {
    icon: <Trash2 size={10} />,
    color: "text-rose-400 border-rose-500/25 bg-rose-950/30",
    label: () => "",
    verb: "Clearing canvas",
  },
};

// ─── SSE parser ───────────────────────────────────────────────────────────────

async function* parseSSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data);
        } catch {}
      }
    }
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentSidebar() {
  const { address } = useAccount();
  const {
    nodes,
    edges,
    nodeInstances,
    addNodeToCanvas,
    onConnect,
    updateNodeConfig,
    clearCanvas,
    setAgentOpen,
  } = useStore();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const nodeIdMapRef = useRef<Record<string, string>>({});
  const apiHistoryRef = useRef<ApiMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === "welcome" &&
        msg.role === "assistant" &&
        msg.content.includes("AVAX bot builder agent")
          ? { ...msg, content: WELCOME_MESSAGE }
          : msg,
      ),
    );
  }, []);

  useEffect(() => {
    if (!address) return;
    fetch("/api/user-settings", {
      headers: { "x-wallet-address": address },
    })
      .then((r) => r.json())
      .then((data: { hasApiKey?: boolean }) => setHasApiKey(!!data.hasApiKey))
      .catch(() => setHasApiKey(false));
  }, [address]);

  function getCanvasState() {
    return {
      nodeCount: nodes.length,
      nodes: nodes.map((n) => {
        const inst = nodeInstances.get(n.id);
        return {
          id: n.id,
          type: (n.data as Record<string, unknown>).nodeType,
          config: inst?.config ?? {},
        };
      }),
      edges: edges.map((e) => ({
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
      })),
    };
  }

  async function executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    await new Promise((r) => setTimeout(r, 420));

    if (name === "clear_canvas") {
      clearCanvas();
      nodeIdMapRef.current = {};
      return JSON.stringify({ success: true });
    }
    if (name === "add_node") {
      const type = String(args.type ?? "");
      const x = typeof args.x === "number" ? args.x : 0;
      const y = typeof args.y === "number" ? args.y : 0;
      try {
        const nodeId = addNodeToCanvas(type, { x, y });
        if (args.label) nodeIdMapRef.current[String(args.label)] = nodeId;
        nodeIdMapRef.current[nodeId] = nodeId;
        return JSON.stringify({ nodeId });
      } catch (e) {
        return JSON.stringify({ error: String(e) });
      }
    }
    if (name === "connect_nodes") {
      const resolvedSource =
        nodeIdMapRef.current[String(args.sourceId ?? "")] ??
        String(args.sourceId ?? "");
      const resolvedTarget =
        nodeIdMapRef.current[String(args.targetId ?? "")] ??
        String(args.targetId ?? "");
      onConnect({
        source: resolvedSource,
        sourceHandle: String(args.sourceHandle ?? ""),
        target: resolvedTarget,
        targetHandle: String(args.targetHandle ?? ""),
      });
      return JSON.stringify({ success: true });
    }
    if (name === "configure_node") {
      const resolved =
        nodeIdMapRef.current[String(args.nodeId ?? "")] ??
        String(args.nodeId ?? "");
      updateNodeConfig(resolved, args.config as Record<string, unknown>);
      return JSON.stringify({ success: true });
    }
    if (name === "ask_user") return "__ask_user__";
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  const addMsg = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistant = useCallback((patch: Partial<TextMessage>) => {
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") {
          copy[i] = { ...copy[i], ...patch } as TextMessage;
          break;
        }
      }
      return copy;
    });
  }, []);

  async function sendMessage(userText: string) {
    if (!userText.trim() || loading) return;
    setLoading(true);
    setInput("");
    addMsg({ id: `u_${Date.now()}`, role: "user", content: userText });
    apiHistoryRef.current.push({ role: "user", content: userText });
    await streamCompletion();
    setLoading(false);
  }

  async function streamCompletion() {
    abortRef.current = new AbortController();
    const assistantId = `a_${Date.now()}`;
    addMsg({
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      isThinking: true,
    });

    let assistantText = "";
    const toolCallAccum: Record<
      number,
      { id: string; name: string; args: string }
    > = {};

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (address) headers["x-wallet-address"] = address;

      const res = await fetch("/api/agent-builder/agent", {
        method: "POST",
        headers,
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: apiHistoryRef.current,
          canvasState: getCanvasState(),
        }),
      });

      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        updateLastAssistant({
          content: json?.error ?? "Error connecting to agent. Check your API key.",
          streaming: false,
          isThinking: false,
        });
        return;
      }

      for await (const chunk of parseSSE(res.body)) {
        const delta = chunk?.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          updateLastAssistant({ content: assistantText, isThinking: true });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccum[tc.index]) {
              toolCallAccum[tc.index] = {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                args: "",
              };
            }
            if (tc.id) toolCallAccum[tc.index].id = tc.id;
            if (tc.function?.name)
              toolCallAccum[tc.index].name = tc.function.name;
            if (tc.function?.arguments)
              toolCallAccum[tc.index].args += tc.function.arguments;
          }
        }
      }

      // Done streaming — mark thinking complete
      updateLastAssistant({ streaming: false, isThinking: false });
      if (assistantText) {
        apiHistoryRef.current.push({
          role: "assistant",
          content: assistantText,
        });
      }

      const toolCalls = Object.values(toolCallAccum);
      if (toolCalls.length > 0) {
        apiHistoryRef.current.push({
          role: "assistant",
          content: assistantText || "",
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.args },
          })),
        });

        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.args);
          } catch {}

          if (tc.name === "ask_user") {
            const askId = `ask_${Date.now()}`;
            addMsg({
              id: askId,
              role: "ask_user",
              question: args.question as string,
            });
            apiHistoryRef.current.push({
              role: "tool",
              tool_call_id: tc.id,
              content: "__waiting_for_user__",
            });
            setLoading(false);
            return;
          }

          const tcMsgId = `tc_${tc.id}_${Date.now()}`;
          addMsg({
            id: tcMsgId,
            role: "tool_call",
            toolName: tc.name,
            args,
            status: "running",
          });
          const result = await executeTool(tc.name, args);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tcMsgId
                ? ({ ...m, status: "done" } as ToolCallMessage)
                : m,
            ),
          );
          apiHistoryRef.current.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }

        await streamCompletion();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        updateLastAssistant({
          content: assistantText || "Something went wrong.",
          streaming: false,
          isThinking: false,
        });
      }
    }
  }

  async function handleAskUserAnswer(question: string, answer: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "ask_user" && (m as AskUserMessage).question === question
          ? ({ ...m, answered: answer } as AskUserMessage)
          : m,
      ),
    );
    const history = apiHistoryRef.current;
    for (let i = history.length - 1; i >= 0; i--) {
      if (
        history[i].role === "tool" &&
        history[i].content === "__waiting_for_user__"
      ) {
        history[i] = { ...history[i], content: answer };
        break;
      }
    }
    addMsg({ id: `u_ask_${Date.now()}`, role: "user", content: answer });
    apiHistoryRef.current.push({ role: "user", content: answer });
    setLoading(true);
    await streamCompletion();
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome2",
        role: "assistant",
        content: "Chat cleared. What HashKey Chain strategy would you like to build?",
      },
    ]);
    apiHistoryRef.current = [];
    nodeIdMapRef.current = {};
    abortRef.current?.abort();
    setLoading(false);
  }

  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <aside
      className="w-[340px] shrink-0 flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, rgba(17,17,27,0.98) 0%, rgba(8,9,16,0.99) 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(139,92,246,0.92), rgba(59,130,246,0.85))",
            boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
          }}
        >
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/[0.92] leading-none">
            AI Agent
          </p>
          <p className="mt-1 text-[10px] text-white/[0.34] leading-none">
            Omega Bot Builder
          </p>
        </div>
        {loading && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{
              background: "rgba(139,92,246,0.14)",
              border: "1px solid rgba(139,92,246,0.22)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-pulse" />
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-violet-200">
              thinking
            </span>
          </div>
        )}
        <button
          onClick={clearChat}
          className="rounded-lg p-1.5 text-white/25 hover:text-white/70 hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/40"
          title="Clear chat"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={() => setAgentOpen(false)}
          className="rounded-lg p-1.5 text-white/25 hover:text-white/70 hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/40"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
        }}
      >
        {messages.map((msg) => {
          // ── User message ──────────────────────────────────────────────────
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  className="max-w-[85%] px-3.5 py-2.5 rounded-[18px] rounded-tr-sm text-[11px] leading-relaxed text-white/[0.92] whitespace-pre-wrap"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(139,92,246,0.24), rgba(59,130,246,0.18))",
                    border: "1px solid rgba(139,92,246,0.20)",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }

          // ── Assistant message (thinking / final) ──────────────────────────
          if (msg.role === "assistant") {
            const m = msg as TextMessage;
            const isEmpty = !m.content;
            return (
              <div key={m.id} className="flex gap-2.5">
                <div
                  className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: "rgba(139,92,246,0.16)",
                    border: "1px solid rgba(139,92,246,0.26)",
                  }}
                >
                  <Bot size={9} className="text-violet-200" />
                </div>
                <div className="flex-1 min-w-0">
                  {m.isThinking && m.streaming && (
                    // Thinking header — shown while streaming
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Zap size={9} className="text-purple-500" />
                      <span className="text-[9px] text-purple-500 font-medium uppercase tracking-wider">
                        Thinking
                      </span>
                      <ThinkingDots />
                    </div>
                  )}
                  <div
                    className={clsx(
                      "rounded-2xl rounded-tl-sm px-3.5 py-2.5 space-y-0.5",
                      m.isThinking && m.streaming
                        ? "bg-transparent" // no card while thinking
                        : "bg-transparent",
                    )}
                  >
                    {isEmpty ? (
                      <span className="text-white/20 text-[11px]">...</span>
                    ) : m.isThinking && m.streaming ? (
                      // Thinking mode: grayish, slightly dimmed, streaming char-by-char
                      <div
                        className="text-[11px] text-white/45 leading-relaxed italic whitespace-pre-wrap"
                        style={{ fontVariantLigatures: "none" }}
                      >
                        {m.content}
                        <span
                          className="inline-block w-[1px] h-3 bg-purple-400/60 ml-0.5 align-middle"
                          style={{ animation: "blink 1s step-end infinite" }}
                        />
                      </div>
                    ) : (
                      // Final mode: rendered markdown
                      <div className="space-y-0.5">
                        {renderMarkdown(m.content)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ── Tool call card ────────────────────────────────────────────────
          if (msg.role === "tool_call") {
            const m = msg as ToolCallMessage;
            const meta = TOOL_META[m.toolName];
            if (!meta) return null;
            const label = meta.label(m.args);
            return (
              <div
                key={m.id}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-mono ml-7",
                  meta.color,
                )}
              >
                <span className="shrink-0 opacity-70">{meta.icon}</span>
                <span className="opacity-60 shrink-0">{meta.verb}</span>
                {label && <span className="font-medium truncate">{label}</span>}
                <div className="ml-auto shrink-0">
                  {m.status === "running" ? (
                    <Loader2 size={9} className="animate-spin opacity-60" />
                  ) : (
                    <span className="opacity-40">✓</span>
                  )}
                </div>
              </div>
            );
          }

          // ── Ask user bubble ───────────────────────────────────────────────
          if (msg.role === "ask_user") {
            const m = msg as AskUserMessage;
            return (
              <div
                key={m.id}
                className="ml-7 rounded-2xl p-3.5"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.2)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <CircleHelp size={10} className="text-purple-400 shrink-0" />
                  <span className="text-[9px] text-purple-400 font-semibold uppercase tracking-wider">
                    Agent Question
                  </span>
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed mb-3">
                  {m.question}
                </p>
                {m.answered ? (
                  <p className="text-[10px] text-white/30 italic">
                    You answered: {m.answered}
                  </p>
                ) : (
                  <AskUserInput
                    onAnswer={(ans) => handleAskUserAnswer(m.question, ans)}
                  />
                )}
              </div>
            );
          }

          return null;
        })}

        {/* Starter prompts — shown until the first user message */}
        {!hasUserMessage && (
          <div className="pt-1">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                Try one
              </p>
              <span className="text-[10px] text-white/[0.28]">4 ideas</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {QUICK_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => sendMessage(item.prompt)}
                    disabled={loading}
                    className="group flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:-translate-y-0.5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/50"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.16)",
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 text-violet-200" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-white/[0.86]">
                        {item.label}
                      </span>
                      <span className="block truncate text-[9.5px] text-white/[0.36]">
                        {item.desc}
                      </span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/[0.22] transition-colors group-hover:text-white/[0.6]" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-3 pb-3 pt-2.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {hasApiKey === false && (
          <a
            href="/portfolio"
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-[10px] text-amber-300/90 hover:text-amber-200 transition-colors"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)" }}
          >
            <KeyRound size={11} className="shrink-0" />
            <span>Add an OpenRouter API key in <strong>Portfolio → Agent Settings</strong> to use the AI agent</span>
            <ArrowUpRight size={10} className="ml-auto shrink-0 opacity-60" />
          </a>
        )}
        <div
          className="flex items-end gap-2 rounded-[18px] px-3 py-2.5 transition-colors focus-within:border-violet-400/30"
          style={{
            background: "rgba(11,12,20,0.9)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <Sparkles className="mb-1.5 h-4 w-4 shrink-0 text-white/25" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || hasApiKey === false}
            placeholder={hasApiKey === false ? "Add an API key to start chatting…" : "Describe your trading strategy…"}
            rows={2}
            className="flex-1 resize-none bg-transparent text-[11px] leading-relaxed text-white placeholder-white/25 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading || hasApiKey === false}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition hover:scale-105 disabled:opacity-25 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/40"
            style={{
              background:
                input.trim() && !loading
                  ? "linear-gradient(135deg, rgba(139,92,246,0.95), rgba(59,130,246,0.95))"
                  : "rgba(255,255,255,0.06)",
            }}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white/60" />
            ) : (
              <Send size={12} className="text-white" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] text-white/25">
          ↵ send · shift+↵ newline
        </p>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </aside>
  );
}

// ─── Thinking dots animation ──────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="flex items-center gap-0.5 ml-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-purple-500/60"
          style={{ animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

// ─── AskUser input ────────────────────────────────────────────────────────────

function AskUserInput({ onAnswer }: { onAnswer: (answer: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) {
            onAnswer(val);
            setVal("");
          }
        }}
        placeholder="Type your answer…"
        className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-violet-400/50 focus-visible:ring-1 focus-visible:ring-violet-300/25"
        autoFocus
      />
      <button
        onClick={() => {
          if (val.trim()) {
            onAnswer(val);
            setVal("");
          }
        }}
        className="px-3 py-1.5 rounded-xl text-[10px] text-violet-200 font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/40"
        style={{
          background: "rgba(139,92,246,0.2)",
          border: "1px solid rgba(139,92,246,0.3)",
        }}
      >
        Send
      </button>
    </div>
  );
}
