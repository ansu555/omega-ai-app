import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/agent-builder/agent/systemPrompt";
import { AGENT_TOOLS } from "@/lib/agent-builder/agent/tools";
import { decrypt } from "@/lib/agent-wallet/crypto";
import { getWalletFromRequest } from "@/lib/marketplace/wallet-header";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5";

type UserOpenRouterConfig = {
  apiKey: string | null;
  model: string | null;
};

function getEnvOpenRouterKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY ??
    process.env.OPEN_ROUTER_API_KEY ??
    process.env.OPENAI_API_KEY ??
    null
  );
}

async function loadUserOpenRouterConfig(
  userWallet: string | null,
): Promise<UserOpenRouterConfig> {
  if (!userWallet) return { apiKey: null, model: null };

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_settings")
      .select("api_key_ct, api_key_iv, api_key_tag, model")
      .eq("user_wallet", userWallet.toLowerCase())
      .maybeSingle();

    if (error || !data) return { apiKey: null, model: null };

    let apiKey: string | null = null;
    if (data.api_key_ct && data.api_key_iv && data.api_key_tag) {
      try {
        apiKey = decrypt({
          ct: data.api_key_ct as string,
          iv: data.api_key_iv as string,
          tag: data.api_key_tag as string,
        });
      } catch {
        apiKey = null;
      }
    }

    return { apiKey, model: (data.model as string | null) ?? null };
  } catch {
    return { apiKey: null, model: null };
  }
}

export async function POST(req: NextRequest) {
  const { messages, canvasState } = (await req.json()) as {
    messages: { role: string; content: string }[];
    canvasState: { nodeCount: number; nodes: unknown[]; edges: unknown[] };
  };
  const userWallet = getWalletFromRequest(req);
  const userConfig = await loadUserOpenRouterConfig(userWallet);
  const apiKey = userConfig.apiKey ?? getEnvOpenRouterKey();
  const model = userConfig.model ?? DEFAULT_MODEL;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "No OpenRouter API key available. Add one in Portfolio → Agent Settings or configure OPENROUTER_API_KEY.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const systemPrompt = buildSystemPrompt();

  const canvasContext = `Current canvas state: ${JSON.stringify(canvasState)}
Nodes on canvas: ${canvasState.nodeCount}. Use this to understand what's already built if the user asks to extend or modify.`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "Omega Agent Builder",
      },
      body: JSON.stringify({
        model,
        stream: true,
        tools: AGENT_TOOLS,
        tool_choice: "auto",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: canvasContext },
          ...messages,
        ],
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    let userMessage =
      "Agent request failed. Add your OpenRouter API key in Portfolio → Agent Settings.";
    try {
      const parsed = JSON.parse(errText) as {
        error?: { message?: string; code?: number };
      };
      const code = parsed?.error?.code;
      if (code === 401 || code === 403) {
        userMessage =
          "Invalid or missing OpenRouter API key. Go to Portfolio → Agent Settings to add your own key, or contact the site admin.";
      }
    } catch {
      // leave default message
    }
    return new Response(JSON.stringify({ error: userMessage }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
