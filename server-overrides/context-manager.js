"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelContextLimit = getModelContextLimit;
exports.calculateTokenBudget = calculateTokenBudget;
exports.truncateHistory = truncateHistory;
const token_counter_1 = require("./token-counter");
const MODEL_CONTEXT_RULES = [
    ['gpt-5.4-mini', 400_000],
    ['gpt-5.4-nano', 400_000],
    ['gpt-5.4', 1_000_000],
    ['gpt-5', 400_000],
    ['gpt-4o', 128_000],
    ['gpt-4.1', 1_000_000],
    ['gpt-4-turbo', 128_000],
    ['gpt-4', 8_192],
    ['gpt-3.5-turbo', 16_385],
    ['o1', 200_000],
    ['o3', 200_000],
    ['o4-mini', 200_000],
    ['claude-4', 200_000],
    ['claude-3.5', 200_000],
    ['gemini-3', 1_000_000],
    ['gemini-2.5', 1_000_000],
    ['gemini-2.0', 1_000_000],
    ['gemini-1.5', 1_000_000],
    ['gemini', 1_000_000],
    ['gemma4:26b', 256_000],
    ['gemma4:31b', 256_000],
    ['gemma4', 128_000],
    ['gemma3', 128_000],
    ['qwen3.5', 256_000],
    ['qwen3', 128_000],
    ['qwen2.5', 32_000],
    ['qwen2', 32_000],
    ['llama4', 128_000],
    ['llama3.3', 128_000],
    ['llama3.2', 128_000],
    ['llama3.1', 128_000],
    ['llama3', 8_192],
    ['mistral-large', 128_000],
    ['mistral-small', 128_000],
    ['mistral', 32_000],
    ['deepseek-r1', 128_000],
    ['deepseek-v3', 128_000],
    ['deepseek', 64_000],
];
const DEFAULT_CONTEXT_LIMIT = 128_000;
const RESPONSE_RESERVE = 4_096;
const TOOL_DEFINITION_ESTIMATE = 1_900;
function getModelContextLimit(modelName) {
    if (!modelName)
        return DEFAULT_CONTEXT_LIMIT;
    const lower = modelName.toLowerCase();
    for (const [pattern, limit] of MODEL_CONTEXT_RULES) {
        if (lower.startsWith(pattern))
            return limit;
    }
    return DEFAULT_CONTEXT_LIMIT;
}
function calculateTokenBudget(modelName, systemPrompt) {
    const modelLimit = getModelContextLimit(modelName);
    const systemPromptTokens = (0, token_counter_1.countTokens)(systemPrompt);
    const toolDefinitionTokens = TOOL_DEFINITION_ESTIMATE;
    const responseReserve = RESPONSE_RESERVE;
    const availableForHistory = Math.max(0, modelLimit - systemPromptTokens - toolDefinitionTokens - responseReserve);
    return {
        modelLimit,
        systemPromptTokens,
        toolDefinitionTokens,
        responseReserve,
        availableForHistory,
    };
}
function truncateHistory(history, availableTokens) {
    if (history.length === 0)
        return [];
    const measured = history.map((msg) => ({
        message: msg,
        tokenCount: getMessageTokenCount(msg),
    }));
    const totalTokens = measured.reduce((sum, m) => sum + m.tokenCount, 0);
    if (totalTokens <= availableTokens) {
        return history;
    }
    let lastUserIdx = -1;
    for (let i = measured.length - 1; i >= 0; i--) {
        if (measured[i].message.role === 'user') {
            lastUserIdx = i;
            break;
        }
    }
    const tailStart = lastUserIdx >= 0 ? lastUserIdx : measured.length - 1;
    const tail = measured.slice(tailStart);
    let usedTokens = tail.reduce((sum, m) => sum + m.tokenCount, 0);
    if (usedTokens >= availableTokens) {
        return tail.map((m) => m.message);
    }
    const included = [];
    let i = tailStart - 1;
    while (i >= 0) {
        const msg = measured[i];
        const tokens = msg.tokenCount;
        if (usedTokens + tokens > availableTokens)
            break;
        if (msg.message.role === 'assistant' && hasToolCalls(msg.message)) {
            const group = [msg];
            let groupTokens = tokens;
            let j = i + 1;
            while (j < tailStart && measured[j].message.role === 'tool') {
                group.push(measured[j]);
                groupTokens += measured[j].tokenCount;
                j++;
            }
            if (usedTokens + groupTokens > availableTokens)
                break;
            included.unshift(...group);
            usedTokens += groupTokens;
            i--;
            continue;
        }
        included.unshift(msg);
        usedTokens += tokens;
        i--;
    }
    return [...included, ...tail].map((m) => m.message);
}
function hasToolCalls(msg) {
    return !!(msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0);
}
function getMessageTokenCount(msg) {
    const meta = msg.metadata;
    if (meta?.tokenCount && typeof meta.tokenCount === 'number') {
        return meta.tokenCount;
    }
    return (0, token_counter_1.countMessageTokens)(msg.role, msg.content, msg.toolCalls);
}
//# sourceMappingURL=context-manager.js.map