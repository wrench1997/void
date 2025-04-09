/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { FeatureName, ModelSelectionOptions, ProviderName } from './voidSettingsTypes.js';


export const defaultModelsOfProvider = {
	openAI: [ // https://platform.openai.com/docs/models/gp
		'o3-mini',
		'o1',
		'o1-mini',
		'gpt-4o',
		'gpt-4o-mini',
	],
	anthropic: [ // https://docs.anthropic.com/en/docs/about-claude/models
		'claude-3-7-sonnet-latest',
		'claude-3-5-sonnet-latest',
		'claude-3-5-haiku-latest',
		'claude-3-opus-latest',
	],
	xAI: [ // https://docs.x.ai/docs/models?cluster=us-east-1
		'grok-2-latest',
		'grok-3-latest',
	],
	gemini: [ // https://ai.google.dev/gemini-api/docs/models/gemini
		'gemini-2.5-pro-exp-03-25',
		'gemini-2.0-flash',
		'gemini-2.0-flash-lite',
	],
	deepseek: [ // https://api-docs.deepseek.com/quick_start/pricing
		'deepseek-chat',
		'deepseek-reasoner',
	],
	ollama: [ // autodetected
	],
	vLLM: [ // autodetected
	],
	openRouter: [ // https://openrouter.ai/models
		'anthropic/claude-3.7-sonnet:thinking',
		'anthropic/claude-3.7-sonnet',
		'anthropic/claude-3.5-sonnet',
		'deepseek/deepseek-r1',
		'deepseek/deepseek-r1-zero:free',
		'mistralai/codestral-2501',
		'qwen/qwen-2.5-coder-32b-instruct',
		// 'mistralai/mistral-small-3.1-24b-instruct:free',
		'google/gemini-2.0-flash-lite-preview-02-05:free',
		// 'google/gemini-2.0-pro-exp-02-05:free',
		// 'google/gemini-2.0-flash-exp:free',
	],
	groq: [ // https://console.groq.com/docs/models
		'qwen-qwq-32b',
		'llama-3.3-70b-versatile',
		'llama-3.1-8b-instant',
		// 'qwen-2.5-coder-32b', // preview mode (experimental)
	],
	// not supporting mistral right now- it's last on Void usage, and a huge pain to set up since it's nonstandard (it supports codestral FIM but it's on v1/fim/completions, etc)
	// mistral: [ // https://docs.mistral.ai/getting-started/models/models_overview/
	// 	'codestral-latest',
	// 	'mistral-large-latest',
	// 	'ministral-3b-latest',
	// 	'ministral-8b-latest',
	// ],
	openAICompatible: [], // fallback
} as const satisfies Record<ProviderName, string[]>






type ModelOptions = {
	contextWindow: number; // input tokens
	maxOutputTokens: number | null; // output tokens, defaults to 4092
	cost: {                                             // <-- UNUSED
		input: number;
		output: number;
		cache_read?: number;
		cache_write?: number;
	}
	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated';
	supportsTools: false | 'anthropic-style' | 'openai-style';
	supportsFIM: boolean;

	reasoningCapabilities: false | {
		readonly supportsReasoning: true;
		// reasoning options if supports reasoning
		readonly canTurnOffReasoning: boolean; // whether or not the user can disable reasoning mode (false if the model only supports reasoning)
		readonly canIOReasoning: boolean; // whether or not the model actually outputs reasoning (eg o1 lets us control reasoning but not output it)
		readonly reasoningMaxOutputTokens?: number; // overrides normal maxOutputTokens 																			// <-- UNUSED (except anthropic)
		readonly reasoningBudgetSlider?: { type: 'slider'; min: number; max: number; default: number };

		// options related specifically to model output
		// you are allowed to not include openSourceThinkTags if it's not open source (no such cases as of writing)
		// if it's open source, put the think tags here so we parse them out in e.g. ollama
		readonly openSourceThinkTags?: [string, string];
	};
}

type ProviderReasoningIOSettings = {
	// include this in payload to get reasoning
	input?: { includeInPayload?: (reasoningState: SendableReasoningInfo) => null | { [key: string]: any }, };
	// nameOfFieldInDelta: reasoning output is in response.choices[0].delta[deltaReasoningField]
	// needsManualParse: whether we must manually parse out the <think> tags
	output?:
	| { nameOfFieldInDelta?: string, needsManualParse?: undefined, }
	| { nameOfFieldInDelta?: undefined, needsManualParse?: true, };
}

type ProviderSettings = {
	providerReasoningIOSettings?: ProviderReasoningIOSettings; // input/output settings around thinking (allowed to be empty) - only applied if the model supports reasoning output
	modelOptions: { [key: string]: ModelOptions };
	modelOptionsFallback: (modelName: string) => (ModelOptions & { modelName: string }) | null;
}



const modelOptionsDefaults: ModelOptions = {
	contextWindow: 32_000,
	maxOutputTokens: 4_096,
	cost: { input: 0, output: 0 },
	supportsSystemMessage: false,
	supportsTools: false,
	supportsFIM: false,
	reasoningCapabilities: false,
}



// TODO!!! double check all context sizes below
// TODO!!! add openrouter common models
// TODO!!! allow user to modify capabilities and tell them if autodetected model or falling back

const openSourceModelOptions_assumingOAICompat = {
	'deepseekR1': {
		supportsFIM: false,
		supportsSystemMessage: false,
		supportsTools: false,
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'deepseekCoderV3': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		supportsTools: false,
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'deepseekCoderV2': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		supportsTools: false,
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'codestral': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'openhands-lm-32b': { // https://www.all-hands.dev/blog/introducing-openhands-lm-32b----a-strong-open-coding-agent-model
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false, // built on qwen 2.5 32B instruct
		contextWindow: 128_000, maxOutputTokens: 4_096
	},
	'phi4': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: false,
		reasoningCapabilities: false,
		contextWindow: 16_000, maxOutputTokens: 4_096,
	},

	'gemma': { // https://news.ycombinator.com/item?id=43451406
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: false,
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	// llama 4 https://ai.meta.com/blog/llama-4-multimodal-intelligence/
	'llama4-scout': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, maxOutputTokens: 4_096,
	},
	'llama4-maverick': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, maxOutputTokens: 4_096,
	},

	// llama 3
	'llama3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'llama3.1': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'llama3.2': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'llama3.3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	// qwen
	'qwen2.5coder': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
		contextWindow: 32_000, maxOutputTokens: 4_096,
	},
	'qwq': {
		supportsFIM: false, // no FIM, yes reasoning
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 128_000, maxOutputTokens: 8_192,
	},
	// FIM only
	'starcoder2': {
		supportsFIM: true,
		supportsSystemMessage: false,
		supportsTools: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, maxOutputTokens: 8_192,

	},
	'codegemma:2b': {
		supportsFIM: true,
		supportsSystemMessage: false,
		supportsTools: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, maxOutputTokens: 8_192,

	},
} as const satisfies { [s: string]: Omit<ModelOptions, 'cost'> }




const extensiveModelFallback: ProviderSettings['modelOptionsFallback'] = (modelName) => {

	const lower = modelName.toLowerCase()

	const toFallback = (opts: Omit<ModelOptions, 'cost'>): ModelOptions & { modelName: string } => {
		return {
			modelName,
			...opts,
			supportsSystemMessage: opts.supportsSystemMessage ? 'system-role' : false,
			cost: { input: 0, output: 0 },
		}
	}
	if (Object.keys(openSourceModelOptions_assumingOAICompat).map(k => k.toLowerCase()).includes(lower))
		return toFallback(openSourceModelOptions_assumingOAICompat[lower as keyof typeof openSourceModelOptions_assumingOAICompat])

	if (lower.includes('gemini') && (lower.includes('2.5') || lower.includes('2-5'))) return toFallback(geminiModelOptions['gemini-2.5-pro-exp-03-25'])

	if (lower.includes('claude-3-5') || lower.includes('claude-3.5')) return toFallback(anthropicModelOptions['claude-3-5-sonnet-20241022'])
	if (lower.includes('claude')) return toFallback(anthropicModelOptions['claude-3-7-sonnet-20250219'])

	if (lower.includes('grok')) return toFallback(xAIModelOptions['grok-2'])

	if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.deepseekR1 })
	if (lower.includes('deepseek') && lower.includes('v2')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.deepseekCoderV2 })
	if (lower.includes('deepseek')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.deepseekCoderV3 })

	if (lower.includes('llama3')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.llama3, })
	if (lower.includes('llama3.1')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['llama3.1'], })
	if (lower.includes('llama3.2')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['llama3.2'], })
	if (lower.includes('llama3.3')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['llama3.3'], })
	if (lower.includes('llama') || lower.includes('scout')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['llama4-scout'] })
	if (lower.includes('llama') || lower.includes('maverick')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['llama4-scout'] })
	if (lower.includes('llama')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['llama4-scout'] })

	if (lower.includes('qwen') && lower.includes('2.5') && lower.includes('coder')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['qwen2.5coder'] })
	if (lower.includes('qwq')) { return toFallback({ ...openSourceModelOptions_assumingOAICompat.qwq, }) }
	if (lower.includes('phi4')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.phi4, })
	if (lower.includes('codestral')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.codestral })

	if (lower.includes('gemma')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.gemma, })

	if (lower.includes('starcoder2')) return toFallback({ ...openSourceModelOptions_assumingOAICompat.starcoder2, })

	if (lower.includes('openhands')) return toFallback({ ...openSourceModelOptions_assumingOAICompat['openhands-lm-32b'], }) // max output unclear

	if (lower.includes('4o') && lower.includes('mini')) return toFallback(openAIModelOptions['gpt-4o-mini'])
	if (lower.includes('4o')) return toFallback(openAIModelOptions['gpt-4o'])
	if (lower.includes('o1') && lower.includes('mini')) return toFallback(openAIModelOptions['o1-mini'])
	if (lower.includes('o1')) return toFallback(openAIModelOptions['o1'])
	if (lower.includes('o3') && lower.includes('mini')) return toFallback(openAIModelOptions['o3-mini'])
	// if (lower.includes('o3')) return toFallback(openAIModelOptions['o3'])

	return toFallback(modelOptionsDefaults)
}






// ---------------- ANTHROPIC ----------------
const anthropicModelOptions = {
	'claude-3-7-sonnet-20250219': { // https://docs.anthropic.com/en/docs/about-claude/models/all-models#model-comparison-table
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		supportsTools: 'anthropic-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canTurnOffReasoning: true,
			canIOReasoning: true,
			reasoningMaxOutputTokens: 64_000, // can bump it to 128_000 with beta mode output-128k-2025-02-19
			reasoningBudgetSlider: { type: 'slider', min: 1024, max: 32_000, default: 1024 }, // they recommend batching if max > 32_000
		},
	},
	'claude-3-5-sonnet-20241022': {
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		supportsTools: 'anthropic-style',
		reasoningCapabilities: false,
	},
	'claude-3-5-haiku-20241022': {
		contextWindow: 200_000,
		maxOutputTokens: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 },
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		supportsTools: 'anthropic-style',
		reasoningCapabilities: false,
	},
	'claude-3-opus-20240229': {
		contextWindow: 200_000,
		maxOutputTokens: 4_096,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 75.00 },
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		supportsTools: 'anthropic-style',
		reasoningCapabilities: false,
	},
	'claude-3-sonnet-20240229': { // no point of using this, but including this for people who put it in
		contextWindow: 200_000, cost: { input: 3.00, output: 15.00 },
		maxOutputTokens: 4_096,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		supportsTools: 'anthropic-style',
		reasoningCapabilities: false,
	}
} as const satisfies { [s: string]: ModelOptions }

const anthropicSettings: ProviderSettings = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (reasoningInfo?.type === 'budgetEnabled') {
					return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
				}
				return null
			}
		},
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof anthropicModelOptions | null = null
		if (lower.includes('claude-3-7-sonnet')) fallbackName = 'claude-3-7-sonnet-20250219'
		if (lower.includes('claude-3-5-sonnet')) fallbackName = 'claude-3-5-sonnet-20241022'
		if (lower.includes('claude-3-5-haiku')) fallbackName = 'claude-3-5-haiku-20241022'
		if (lower.includes('claude-3-opus')) fallbackName = 'claude-3-opus-20240229'
		if (lower.includes('claude-3-sonnet')) fallbackName = 'claude-3-sonnet-20240229'
		if (fallbackName) return { modelName: fallbackName, ...anthropicModelOptions[fallbackName] }
		return { modelName, ...modelOptionsDefaults, maxOutputTokens: 4_096 }
	},
}


// ---------------- OPENAI ----------------
const openAIModelOptions = { // https://platform.openai.com/docs/pricing
	'o1': {
		contextWindow: 128_000,
		maxOutputTokens: 100_000,
		cost: { input: 15.00, cache_read: 7.50, output: 60.00, },
		supportsFIM: false,
		supportsTools: false,
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false }, // it doesn't actually output reasoning, but our logic is fine with it
	},
	'o3-mini': {
		contextWindow: 200_000,
		maxOutputTokens: 100_000,
		cost: { input: 1.10, cache_read: 0.55, output: 4.40, },
		supportsFIM: false,
		supportsTools: false,
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false },
	},
	'gpt-4o': {
		contextWindow: 128_000,
		maxOutputTokens: 16_384,
		cost: { input: 2.50, cache_read: 1.25, output: 10.00, },
		supportsFIM: false,
		supportsTools: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'o1-mini': {
		contextWindow: 128_000,
		maxOutputTokens: 65_536,
		cost: { input: 1.10, cache_read: 0.55, output: 4.40, },
		supportsFIM: false,
		supportsTools: false,
		supportsSystemMessage: false, // does not support any system
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false },
	},
	'gpt-4o-mini': {
		contextWindow: 128_000,
		maxOutputTokens: 16_384,
		cost: { input: 0.15, cache_read: 0.075, output: 0.60, },
		supportsFIM: false,
		supportsTools: 'openai-style',
		supportsSystemMessage: 'system-role', // ??
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: ModelOptions }


const openAISettings: ProviderSettings = {
	modelOptions: openAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof openAIModelOptions | null = null
		if (lower.includes('o1')) { fallbackName = 'o1' }
		if (lower.includes('o3-mini')) { fallbackName = 'o3-mini' }
		if (lower.includes('gpt-4o')) { fallbackName = 'gpt-4o' }
		if (fallbackName) return { modelName: fallbackName, ...openAIModelOptions[fallbackName] }
		return null
	}
}

// ---------------- XAI ----------------
const xAIModelOptions = {
	'grok-2': {
		contextWindow: 131_072,
		maxOutputTokens: null, // 131_072,
		cost: { input: 2.00, output: 10.00 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: ModelOptions }

const xAISettings: ProviderSettings = {
	modelOptions: xAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof xAIModelOptions | null = null
		if (lower.includes('grok-2')) fallbackName = 'grok-2'
		if (fallbackName) return { modelName: fallbackName, ...xAIModelOptions[fallbackName] }
		return null
	}
}


// ---------------- GEMINI ----------------
const geminiModelOptions = { // https://ai.google.dev/gemini-api/docs/pricing
	'gemini-2.5-pro-exp-03-25': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style', // we are assuming OpenAI SDK when calling gemini
		reasoningCapabilities: false,
	},
	'gemini-2.0-flash': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192, // 8_192,
		cost: { input: 0.10, output: 0.40 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style', // we are assuming OpenAI SDK when calling gemini
		reasoningCapabilities: false,
	},
	'gemini-2.0-flash-lite-preview-02-05': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192, // 8_192,
		cost: { input: 0.075, output: 0.30 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'gemini-1.5-flash': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192, // 8_192,
		cost: { input: 0.075, output: 0.30 },  // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'gemini-1.5-pro': {
		contextWindow: 2_097_152,
		maxOutputTokens: 8_192,
		cost: { input: 1.25, output: 5.00 },  // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'gemini-1.5-flash-8b': {
		contextWindow: 1_048_576,
		maxOutputTokens: 8_192,
		cost: { input: 0.0375, output: 0.15 },  // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: ModelOptions }

const geminiSettings: ProviderSettings = {
	modelOptions: geminiModelOptions,
	modelOptionsFallback: (modelName) => { return null }
}



// ---------------- DEEPSEEK API ----------------
const deepseekModelOptions = {
	'deepseek-chat': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 64_000, // https://api-docs.deepseek.com/quick_start/pricing
		maxOutputTokens: 8_000, // 8_000,
		cost: { cache_read: .07, input: .27, output: 1.10, },
	},
	'deepseek-reasoner': {
		...openSourceModelOptions_assumingOAICompat.deepseekCoderV2,
		contextWindow: 64_000,
		maxOutputTokens: 8_000, // 8_000,
		cost: { cache_read: .14, input: .55, output: 2.19, },
	},
} as const satisfies { [s: string]: ModelOptions }


const deepseekSettings: ProviderSettings = {
	modelOptions: deepseekModelOptions,
	providerReasoningIOSettings: {
		// reasoning: OAICompat +  response.choices[0].delta.reasoning_content // https://api-docs.deepseek.com/guides/reasoning_model
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
	modelOptionsFallback: (modelName) => { return null }
}

// ---------------- GROQ ----------------
const groqModelOptions = { // https://console.groq.com/docs/models, https://groq.com/pricing/
	'llama-3.3-70b-versatile': {
		contextWindow: 128_000,
		maxOutputTokens: 32_768, // 32_768,
		cost: { input: 0.59, output: 0.79 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'llama-3.1-8b-instant': {
		contextWindow: 128_000,
		maxOutputTokens: 8_192,
		cost: { input: 0.05, output: 0.08 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'qwen-2.5-coder-32b': {
		contextWindow: 128_000,
		maxOutputTokens: null, // not specified?
		cost: { input: 0.79, output: 0.79 },
		supportsFIM: false, // unfortunately looks like no FIM support on groq
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'qwen-qwq-32b': { // https://huggingface.co/Qwen/QwQ-32B
		contextWindow: 128_000,
		maxOutputTokens: null, // not specified?
		cost: { input: 0.29, output: 0.39 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ['<think>', '</think>'] }, // we're using reasoning_format:parsed so really don't need to know openSourceThinkTags
	},
} as const satisfies { [s: string]: ModelOptions }
const groqSettings: ProviderSettings = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (reasoningInfo?.type === 'budgetEnabled') {
					return { reasoning_format: 'parsed' }
				}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	}, // Must be set to either parsed or hidden when using tool calling https://console.groq.com/docs/reasoning
	modelOptions: groqModelOptions,
	modelOptionsFallback: (modelName) => { return null }
}


// ---------------- VLLM, OLLAMA, OPENAICOMPAT (self-hosted / local) ----------------
const vLLMSettings: ProviderSettings = {
	// reasoning: OAICompat + response.choices[0].delta.reasoning_content // https://docs.vllm.ai/en/stable/features/reasoning_outputs.html#streaming-chat-completions
	providerReasoningIOSettings: { output: { nameOfFieldInDelta: 'reasoning_content' }, },
	modelOptionsFallback: (modelName) => extensiveModelFallback(modelName),
	modelOptions: {},
}

const ollamaSettings: ProviderSettings = {
	// reasoning: we need to filter out reasoning <think> tags manually
	providerReasoningIOSettings: { output: { needsManualParse: true }, },
	modelOptionsFallback: (modelName) => extensiveModelFallback(modelName),
	modelOptions: {},
}

const openaiCompatible: ProviderSettings = {
	// reasoning: we have no idea what endpoint they used, so we can't consistently parse out reasoning
	modelOptionsFallback: (modelName) => extensiveModelFallback(modelName),
	modelOptions: {},
}


// ---------------- OPENROUTER ----------------
const openRouterModelOptions_assumingOpenAICompat = {
	'mistralai/mistral-small-3.1-24b-instruct:free': {
		contextWindow: 128_000,
		maxOutputTokens: null,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		supportsTools: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-lite-preview-02-05:free': {
		contextWindow: 1_048_576,
		maxOutputTokens: null,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		supportsTools: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-pro-exp-02-05:free': {
		contextWindow: 1_048_576,
		maxOutputTokens: null,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		supportsTools: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-exp:free': {
		contextWindow: 1_048_576,
		maxOutputTokens: null,
		cost: { input: 0, output: 0 },
		supportsFIM: false,
		supportsTools: 'openai-style',
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'deepseek/deepseek-r1': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 128_000,
		maxOutputTokens: null,
		cost: { input: 0.8, output: 2.4 },
	},
	'anthropic/claude-3.7-sonnet:thinking': {
		contextWindow: 200_000,
		maxOutputTokens: null,
		cost: { input: 3.00, output: 15.00 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: { // same as anthropic, see above
			supportsReasoning: true,
			canTurnOffReasoning: false,
			canIOReasoning: true,
			reasoningMaxOutputTokens: 64_000,
			reasoningBudgetSlider: { type: 'slider', min: 1024, max: 32_000, default: 1024 }, // they recommend batching if max > 32_000
		},
	},
	'anthropic/claude-3.7-sonnet': {
		contextWindow: 200_000,
		maxOutputTokens: null,
		cost: { input: 3.00, output: 15.00 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false, // stupidly, openrouter separates thinking from non-thinking
	},
	'anthropic/claude-3.5-sonnet': {
		contextWindow: 200_000,
		maxOutputTokens: null,
		cost: { input: 3.00, output: 15.00 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'mistralai/codestral-2501': {
		...openSourceModelOptions_assumingOAICompat.codestral,
		contextWindow: 256_000,
		maxOutputTokens: null,
		cost: { input: 0.3, output: 0.9 },
		supportsTools: 'openai-style',
		reasoningCapabilities: false,
	},
	'qwen/qwen-2.5-coder-32b-instruct': {
		...openSourceModelOptions_assumingOAICompat['qwen2.5coder'],
		contextWindow: 33_000,
		maxOutputTokens: null,
		supportsTools: false, // openrouter qwen doesn't seem to support tools...?
		cost: { input: 0.07, output: 0.16 },
	},
	'qwen/qwq-32b': {
		...openSourceModelOptions_assumingOAICompat['qwq'],
		contextWindow: 33_000,
		maxOutputTokens: null,
		supportsTools: false, // openrouter qwen doesn't seem to support tools...?
		cost: { input: 0.07, output: 0.16 },
	}
} as const satisfies { [s: string]: ModelOptions }

const openRouterSettings: ProviderSettings = {
	// reasoning: OAICompat + response.choices[0].delta.reasoning : payload should have {include_reasoning: true} https://openrouter.ai/announcements/reasoning-tokens-for-thinking-models
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (reasoningInfo?.type === 'budgetEnabled') {
					return {
						reasoning: {
							max_tokens: reasoningInfo.reasoningBudget
						}
					}
				}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
	modelOptions: openRouterModelOptions_assumingOpenAICompat,
	// TODO!!! send a query to openrouter to get the price, etc.
	modelOptionsFallback: (modelName) => extensiveModelFallback(modelName),
}




// ---------------- model settings of everything above ----------------

const modelSettingsOfProvider: { [providerName in ProviderName]: ProviderSettings } = {
	openAI: openAISettings,
	anthropic: anthropicSettings,
	xAI: xAISettings,
	gemini: geminiSettings,

	// open source models
	deepseek: deepseekSettings,
	groq: groqSettings,

	// open source models + providers (mixture of everything)
	openRouter: openRouterSettings,
	vLLM: vLLMSettings,
	ollama: ollamaSettings,
	openAICompatible: openaiCompatible,

	// TODO!!!
	// googleVertex: {},
	// microsoftAzure: {},
	// openHands: {},
} as const


// ---------------- exports ----------------

// returns the capabilities and the adjusted modelName if it was a fallback
export const getModelCapabilities = (providerName: ProviderName, modelName: string): ModelOptions & { modelName: string; isUnrecognizedModel: boolean } => {
	const lowercaseModelName = modelName.toLowerCase()
	const { modelOptions, modelOptionsFallback } = modelSettingsOfProvider[providerName]

	// search model options object directly first
	for (const modelName_ in modelOptions) {
		const lowercaseModelName_ = modelName_.toLowerCase()
		if (lowercaseModelName === lowercaseModelName_)
			return { modelName, ...modelOptions[modelName], isUnrecognizedModel: false }
	}

	const result = modelOptionsFallback(modelName)
	if (result) return { ...result, isUnrecognizedModel: false }
	return { modelName, ...modelOptionsDefaults, isUnrecognizedModel: true }
}

// non-model settings
export const getProviderCapabilities = (providerName: ProviderName) => {
	const { providerReasoningIOSettings } = modelSettingsOfProvider[providerName]
	return { providerReasoningIOSettings }
}


export type SendableReasoningInfo = {
	type: 'budgetEnabled',
	isReasoningEnabled: true,
	reasoningBudget: number,
} | null



export const getIsReasoningEnabledState = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
) => {
	const { supportsReasoning, canTurnOffReasoning } = getModelCapabilities(providerName, modelName).reasoningCapabilities || {}
	if (!supportsReasoning) return false

	// default to enabled if can't turn off, or if the featureName is Chat.
	const defaultEnabledVal = featureName === 'Chat' || !canTurnOffReasoning

	const isReasoningEnabled = modelSelectionOptions?.reasoningEnabled ?? defaultEnabledVal
	return isReasoningEnabled
}


// used to force reasoning state (complex) into something simple we can just read from when sending a message
export const getSendableReasoningInfo = (
	featureName: FeatureName,
	providerName: ProviderName,
	modelName: string,
	modelSelectionOptions: ModelSelectionOptions | undefined,
): SendableReasoningInfo => {

	const { canIOReasoning, reasoningBudgetSlider } = getModelCapabilities(providerName, modelName).reasoningCapabilities || {}
	if (!canIOReasoning) return null
	const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions)
	if (!isReasoningEnabled) return null

	// check for reasoning budget
	const reasoningBudget = reasoningBudgetSlider?.type === 'slider' ? modelSelectionOptions?.reasoningBudget ?? reasoningBudgetSlider?.default : undefined
	if (reasoningBudget) {
		return { type: 'budgetEnabled', isReasoningEnabled: isReasoningEnabled, reasoningBudget: reasoningBudget }
	}
	return null
}
