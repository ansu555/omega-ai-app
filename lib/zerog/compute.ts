/**
 * 0G Compute Network wrapper
 *
 * 0G Compute is a decentralized AI inference & training network.
 * Agents submit inference requests to 0G Compute nodes; the network
 * routes them to available providers running the requested model.
 *
 * Available models (Newton Testnet):
 *   - qwen3-8b            — fast, general-purpose reasoning
 *   - qwen3.6-plus        — sealed inference (verified on-chain)
 *   - GLM-5-FP8           — high-accuracy, sealed inference
 *   - llama3-8b           — open-weight, cost-efficient
 *
 * Sealed inference: the provider's output is committed on-chain via
 * a ZK proof — you can verify the model ran correctly without trusting
 * the provider. Use sealed=true for decision-critical agent calls.
 *
 * Endpoint: https://compute-api.0g.ai/v1
 */

import { ZEROG_COMPUTE_ENDPOINT } from './config'

export type ZeroGModel =
  | 'qwen3-8b'
  | 'qwen3.6-plus'
  | 'GLM-5-FP8'
  | 'llama3-8b'
  | (string & NonNullable<unknown>)

export interface ComputeMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ComputeRequest {
  model: ZeroGModel
  messages: ComputeMessage[]
  /** Max tokens to generate */
  maxTokens?: number
  /** Sampling temperature 0.0–2.0 */
  temperature?: number
  /** Request sealed (ZK-verified) inference — use for decision-critical calls */
  sealed?: boolean
  /** Your 0G Compute API key */
  apiKey?: string
}

export interface ComputeResponse {
  id: string
  model: string
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** On-chain proof reference for sealed inference */
  proofRef?: string
  finishReason: 'stop' | 'length' | 'content_filter'
}

export interface ComputeStreamChunk {
  delta: string
  done: boolean
  proofRef?: string
}

// ── Core inference ─────────────────────────────────────────────────────────────

/**
 * Run a single inference call against the 0G Compute network.
 *
 * @example
 *   const response = await computeInference({
 *     model: 'qwen3.6-plus',
 *     messages: [{ role: 'user', content: 'Analyze this market signal: ...' }],
 *     sealed: true,
 *   })
 */
export async function computeInference(
  request: ComputeRequest,
  endpoint = ZEROG_COMPUTE_ENDPOINT,
): Promise<ComputeResponse> {
  const apiKey = request.apiKey ?? (typeof process !== 'undefined' ? process.env.ZEROG_COMPUTE_API_KEY : undefined)

  const body = {
    model: request.model,
    messages: request.messages,
    max_tokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
    ...(request.sealed ? { sealed: true } : {}),
  }

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`0G Compute error ${res.status}: ${text}`)
  }

  const data = await res.json() as {
    id: string
    model: string
    choices: Array<{ message: { content: string }; finish_reason: string }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    proof_ref?: string
  }

  return {
    id: data.id,
    model: data.model,
    content: data.choices[0]?.message?.content ?? '',
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    proofRef: data.proof_ref,
    finishReason: (data.choices[0]?.finish_reason ?? 'stop') as ComputeResponse['finishReason'],
  }
}

/**
 * Stream inference from 0G Compute — yields delta chunks as they arrive.
 * Useful for the copilot tile and real-time agent logging.
 *
 * @example
 *   for await (const chunk of streamComputeInference({ model: 'qwen3-8b', messages })) {
 *     process.stdout.write(chunk.delta)
 *     if (chunk.done) break
 *   }
 */
export async function* streamComputeInference(
  request: ComputeRequest,
  endpoint = ZEROG_COMPUTE_ENDPOINT,
): AsyncGenerator<ComputeStreamChunk> {
  const apiKey = request.apiKey ?? (typeof process !== 'undefined' ? process.env.ZEROG_COMPUTE_API_KEY : undefined)

  const body = {
    model: request.model,
    messages: request.messages,
    max_tokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
    stream: true,
    ...(request.sealed ? { sealed: true } : {}),
  }

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`0G Compute stream error ${res.status}: ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('0G Compute: no response body stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') {
        yield { delta: '', done: true }
        return
      }
      try {
        const parsed = JSON.parse(raw) as {
          choices: Array<{ delta: { content?: string }; finish_reason?: string }>
          proof_ref?: string
        }
        const delta = parsed.choices[0]?.delta?.content ?? ''
        const isDone = parsed.choices[0]?.finish_reason === 'stop'
        yield { delta, done: isDone, proofRef: parsed.proof_ref }
        if (isDone) return
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

// ── Agent-specific helpers ─────────────────────────────────────────────────────

/**
 * Quick single-turn agent reasoning call using the default model (qwen3-8b).
 * Use this for lightweight agent decisions; use sealed=true for critical paths.
 */
export async function agentReason(
  prompt: string,
  systemPrompt?: string,
  options?: Partial<ComputeRequest>,
): Promise<string> {
  const messages: ComputeMessage[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    { role: 'user', content: prompt },
  ]

  const response = await computeInference({
    model: 'qwen3-8b',
    messages,
    maxTokens: 1024,
    ...options,
  })

  return response.content
}

/**
 * Returns available models from the 0G Compute network.
 */
export async function listComputeModels(
  endpoint = ZEROG_COMPUTE_ENDPOINT,
  apiKey?: string,
): Promise<string[]> {
  const key = apiKey ?? (typeof process !== 'undefined' ? process.env.ZEROG_COMPUTE_API_KEY : undefined)
  const res = await fetch(`${endpoint}/models`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })
  if (!res.ok) return ['qwen3-8b', 'qwen3.6-plus', 'GLM-5-FP8', 'llama3-8b']
  const data = await res.json() as { data: Array<{ id: string }> }
  return data.data.map(m => m.id)
}
