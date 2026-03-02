interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-opus-4': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-haiku-3.5': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'gpt-5.3-codex': { inputPerMillion: 5, outputPerMillion: 15 },
  'gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
}

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
}

export function formatTokenCount(count: number): string {
  if (count < 1000) {
    return String(count)
  }

  if (count < 1_000_000) {
    return `${(count / 1000).toFixed(1)}K`
  }

  return `${(count / 1_000_000).toFixed(2)}M`
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId?: string,
): number {
  const pricing = (modelId ? MODEL_PRICING[modelId] : undefined) ?? DEFAULT_PRICING
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion
  return inputCost + outputCost
}

export function formatCost(cost: number): string {
  if (cost < 0.001) {
    return '< $0.001'
  }

  return `$${cost.toFixed(4)}`
}
