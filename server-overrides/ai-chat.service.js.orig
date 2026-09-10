"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AiChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatService = void 0;
const common_1 = require("@nestjs/common");
const ai_1 = require("ai");
const openai_1 = require("@ai-sdk/openai");
const google_1 = require("@ai-sdk/google");
const openai_compatible_1 = require("@ai-sdk/openai-compatible");
const ai_sdk_ollama_1 = require("ai-sdk-ollama");
const ai_chat_repo_1 = require("./ai-chat.repo");
const ai_chat_tools_service_1 = require("./ai-chat-tools.service");
const page_repo_1 = require("../../database/repos/page/page.repo");
const attachment_repo_1 = require("../../database/repos/attachment/attachment.repo");
const page_access_service_1 = require("../../core/page/page-access/page-access.service");
const environment_service_1 = require("../../integrations/environment/environment.service");
const storage_service_1 = require("../../integrations/storage/storage.service");
const attachment_ee_service_1 = require("../attachments-ee/attachment-ee.service");
const ai_constants_1 = require("../ai/ai.constants");
const ai_config_interface_1 = require("../ai/drivers/interfaces/ai-config.interface");
const collaboration_util_1 = require("../../collaboration/collaboration.util");
const page_content_extractor_1 = require("./utils/page-content-extractor");
const token_counter_1 = require("./utils/token-counter");
const attachment_utils_1 = require("../../core/attachment/attachment.utils");
const uuid_1 = require("uuid");
const attachment_constants_1 = require("../../core/attachment/attachment.constants");
const tool_call_correlation_1 = require("./utils/tool-call-correlation");
const untrusted_content_1 = require("./utils/untrusted-content");
const locale_language_1 = require("../ai/utils/locale-language");
const model_capabilities_1 = require("../ai/utils/model-capabilities");
const token_counter_2 = require("./utils/token-counter");
const context_manager_1 = require("./utils/context-manager");
const history_compressor_1 = require("./utils/history-compressor");
const ai_chat_errors_1 = require("./utils/ai-chat-errors");
const ai_chat_limits_1 = require("./utils/ai-chat-limits");
const token_counter_3 = require("./utils/token-counter");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../../integrations/queue/constants");
const CHAT_TEMPERATURE = 0.2;
let AiChatService = AiChatService_1 = class AiChatService {
    constructor(chatRepo, toolsService, pageRepo, attachmentRepo, pageAccessService, environmentService, storageService, attachmentEeService, aiConfig, attachmentQueue) {
        this.chatRepo = chatRepo;
        this.toolsService = toolsService;
        this.pageRepo = pageRepo;
        this.attachmentRepo = attachmentRepo;
        this.pageAccessService = pageAccessService;
        this.environmentService = environmentService;
        this.storageService = storageService;
        this.attachmentEeService = attachmentEeService;
        this.aiConfig = aiConfig;
        this.attachmentQueue = attachmentQueue;
        this.logger = new common_1.Logger(AiChatService_1.name);
    }
    async createChat(userId, workspaceId, title) {
        return this.chatRepo.insertChat({
            creatorId: userId,
            workspaceId,
            title: title || null,
        });
    }
    async getChat(chatId, userId, workspaceId) {
        const chat = await this.chatRepo.findChatById(chatId);
        if (!chat || chat.creatorId !== userId || chat.workspaceId !== workspaceId) {
            throw new common_1.NotFoundException('Chat not found');
        }
        return chat;
    }
    async getChatWithMessages(chatId, userId, workspaceId) {
        const chat = await this.getChat(chatId, userId, workspaceId);
        const messages = await this.chatRepo.findMessagesByChatId(chatId);
        return { chat, messages };
    }
    async deleteChat(chatId, userId, workspaceId) {
        const chat = await this.getChat(chatId, userId, workspaceId);
        await this.chatRepo.deleteChat(chat.id);
        await this.attachmentQueue.add(constants_1.QueueJob.DELETE_AI_CHAT_ATTACHMENTS, {
            aiChatId: chat.id,
        });
    }
    async updateChatTitle(chatId, userId, workspaceId, title) {
        const chat = await this.getChat(chatId, userId, workspaceId);
        await this.chatRepo.updateChatTitle(chat.id, title);
    }
    async *sendMessage(user, workspace, params, abortSignal) {
        const model = this.resolveLanguageModel();
        if (!model) {
            throw new common_1.BadRequestException('AI is not configured');
        }
        const aiChatEnabled = workspace?.settings?.['ai']?.['chat'] === true;
        if (!aiChatEnabled) {
            throw new common_1.ForbiddenException('AI Chat is not enabled for this workspace');
        }
        let chat;
        let isNewChat = false;
        if (params.chatId) {
            chat = await this.getChat(params.chatId, user.id, workspace.id);
        }
        else {
            chat = await this.createChat(user.id, workspace.id);
            isNewChat = true;
        }
        if (isNewChat &&
            params.attachmentIds &&
            params.attachmentIds.length > 0) {
            await this.attachmentRepo.claimAttachmentsForChat(params.attachmentIds, chat.id, user.id, workspace.id);
        }
        const contextPageIds = [];
        if (params.contextPageId && isNewChat) {
            contextPageIds.push(params.contextPageId);
        }
        const explicitMentionIds = params.mentionedPageIds || [];
        const allMentionIds = [...new Set([...contextPageIds, ...explicitMentionIds])];
        const pageJsonCache = new Map();
        const mentionedPages = await this.fetchMentionedPages(allMentionIds, user, pageJsonCache, params.content);
        const attachments = await this.fetchAttachments(params.attachmentIds || [], user.id, workspace.id);
        const metadata = {};
        if (params.contextPageId) {
            metadata.contextPageId = params.contextPageId;
        }
        if (allMentionIds.length > 0) {
            metadata.mentionedPageIds = allMentionIds;
        }
        if (attachments.length > 0) {
            metadata.attachments = attachments.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                fileExt: a.fileExt,
            }));
        }
        const userTokenCount = (0, token_counter_2.countMessageTokens)('user', params.content);
        metadata.tokenCount = userTokenCount;
        await this.chatRepo.insertMessage({
            chatId: chat.id,
            workspaceId: workspace.id,
            userId: user.id,
            role: 'user',
            content: params.content,
            metadata: metadata,
        });
        if (isNewChat) {
            const title = params.content.slice(0, 100);
            await this.chatRepo.updateChatTitle(chat.id, title);
            yield { type: 'chat_created', chatId: chat.id };
        }
        const systemPrompt = this.buildSystemPrompt(workspace, user.locale);
        const modelName = this.getChatModelName();
        const budget = (0, context_manager_1.calculateTokenBudget)(modelName, systemPrompt);
        const attachmentReserve = attachments.length > 0 ? ai_chat_limits_1.MAX_ATTACHMENT_TOKENS_CUMULATIVE : 0;
        const historyBudget = Math.max(0, budget.availableForHistory - attachmentReserve);
        let fullHistory = await this.chatRepo.findMessagesByChatId(chat.id);
        if ((0, history_compressor_1.shouldCompress)(fullHistory, historyBudget)) {
            fullHistory = await this.compressOlderHistory(model, chat.id, workspace.id, user.id, fullHistory, historyBudget);
        }
        const history = (0, context_manager_1.truncateHistory)(fullHistory, historyBudget);
        const modelMessages = await this.buildModelMessages(history, attachments, mentionedPages);
        const tools = this.toolsService.createTools(user, workspace, pageJsonCache, params.content);
        const toolCalls = [];
        let fullText = '';
        let disconnected = false;
        const onAbort = () => { disconnected = true; };
        abortSignal?.addEventListener('abort', onAbort, { once: true });
        try {
            const result = (0, ai_1.streamText)({
                model,
                system: systemPrompt,
                messages: modelMessages,
                tools,
                ...((0, model_capabilities_1.supportsTemperature)(modelName)
                    ? { temperature: CHAT_TEMPERATURE }
                    : {}),
                stopWhen: (0, ai_1.stepCountIs)(5),
                abortSignal,
                onStepFinish: ({ toolCalls: stepToolCalls, toolResults }) => {
                    if (stepToolCalls && stepToolCalls.length > 0) {
                        const rawCalls = stepToolCalls.map((tc) => ({
                            toolCallId: tc.toolCallId,
                            toolName: tc.toolName,
                            input: ('input' in tc ? tc.input : {}),
                        }));
                        const rawResults = (toolResults ?? []).map((tr) => ({
                            toolCallId: tr.toolCallId,
                            output: 'output' in tr ? tr.output : undefined,
                        }));
                        const correlated = (0, tool_call_correlation_1.correlateToolCallsWithResults)(rawCalls, rawResults);
                        for (const c of correlated) {
                            toolCalls.push({
                                id: c.toolCallId,
                                name: c.toolName,
                                args: (c.input ?? {}),
                                result: c.result,
                            });
                        }
                    }
                },
            });
            for await (const part of result.fullStream) {
                if (disconnected)
                    break;
                if (part.type === 'text-delta') {
                    fullText += part.text;
                    yield { type: 'content', text: part.text };
                }
                else if (part.type === 'tool-call') {
                    yield {
                        type: 'tool_call',
                        id: part.toolCallId,
                        name: part.toolName,
                        args: ('input' in part ? part.input : {}),
                    };
                }
                else if (part.type === 'tool-result') {
                    yield {
                        type: 'tool_result',
                        id: part.toolCallId,
                        result: 'output' in part ? part.output : undefined,
                    };
                }
                else if (part.type === 'error') {
                    this.logger.error({ err: part.error }, 'AI stream error part');
                    const classified = (0, ai_chat_errors_1.classifyProviderError)(part.error);
                    yield {
                        type: 'error',
                        message: classified.userMessage,
                        code: classified.code,
                        retryable: classified.retryable,
                    };
                    return;
                }
            }
            if (!fullText && toolCalls.length === 0 && !disconnected) {
                yield {
                    type: 'error',
                    message: 'The AI returned an empty response. Please try again.',
                    code: ai_chat_errors_1.AiChatErrorCode.EMPTY_RESPONSE,
                    retryable: true,
                };
                return;
            }
            let usage = null;
            try {
                usage = await result.usage;
            }
            catch {
            }
            const assistantMessage = await this.saveAssistantMessage(chat.id, workspace.id, user.id, modelName, fullText, toolCalls, usage);
            if (!disconnected) {
                yield {
                    type: 'done',
                    messageId: assistantMessage.id,
                    usage: usage
                        ? {
                            promptTokens: usage.inputTokens,
                            completionTokens: usage.outputTokens,
                            totalTokens: usage.totalTokens,
                        }
                        : undefined,
                };
            }
        }
        catch (error) {
            if (disconnected || abortSignal?.aborted) {
                await this.saveAssistantMessage(chat.id, workspace.id, user.id, modelName, fullText, toolCalls, null).catch((e) => this.logger.warn({ err: e }, 'Failed to save partial message'));
                return;
            }
            this.logger.error({ err: error }, 'AI chat stream error');
            const classified = (0, ai_chat_errors_1.classifyProviderError)(error);
            yield {
                type: 'error',
                message: classified.userMessage,
                code: classified.code,
                retryable: classified.retryable,
            };
        }
        finally {
            abortSignal?.removeEventListener('abort', onAbort);
        }
    }
    async compressOlderHistory(model, chatId, workspaceId, userId, history, availableTokens) {
        try {
            const { older, recent } = (0, history_compressor_1.splitForCompression)(history, availableTokens);
            if (older.length === 0)
                return history;
            const summary = await (0, history_compressor_1.compressHistory)(model, older);
            const summaryMessage = await this.chatRepo.insertMessage({
                chatId,
                workspaceId,
                userId,
                role: 'user',
                content: `[Previous conversation summary]\n${summary}`,
                metadata: {
                    isSummary: true,
                    summarizedMessageCount: older.length,
                    tokenCount: (0, token_counter_2.countMessageTokens)('user', summary),
                },
            });
            return [summaryMessage, ...recent];
        }
        catch (error) {
            this.logger.warn({ err: error }, 'History compression failed, using truncation');
            return history;
        }
    }
    async saveAssistantMessage(chatId, workspaceId, userId, modelName, fullText, toolCalls, usage) {
        const assistantTokenCount = (0, token_counter_2.countMessageTokens)('assistant', fullText, toolCalls.length > 0 ? toolCalls : null);
        const assistantMetadata = {
            model: modelName,
            tokenCount: assistantTokenCount,
        };
        if (usage) {
            assistantMetadata.tokenUsage = {
                promptTokens: usage.inputTokens,
                completionTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
            };
        }
        return this.chatRepo.insertMessage({
            chatId,
            workspaceId,
            userId,
            role: 'assistant',
            content: fullText || null,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            metadata: assistantMetadata,
        });
    }
    resolveLanguageModel() {
        if (!this.aiConfig)
            return null;
        const chatModel = this.getChatModelName();
        if (!chatModel)
            return null;
        switch (this.aiConfig.provider) {
            case ai_config_interface_1.AiDriver.OPENAI: {
                const provider = (0, openai_1.createOpenAI)({
                    apiKey: this.aiConfig.config.apiKey,
                    baseURL: this.aiConfig.config.baseURL,
                });
                return provider(chatModel);
            }
            case ai_config_interface_1.AiDriver.OPENAI_COMPATIBLE: {
                const provider = (0, openai_compatible_1.createOpenAICompatible)({
                    name: 'openai-compatible',
                    apiKey: this.aiConfig.config.apiKey,
                    baseURL: this.aiConfig.config.baseURL,
                });
                return provider(chatModel);
            }
            case ai_config_interface_1.AiDriver.GEMINI: {
                const provider = (0, google_1.createGoogleGenerativeAI)({
                    apiKey: this.aiConfig.config.apiKey,
                });
                return provider(chatModel);
            }
            case ai_config_interface_1.AiDriver.OLLAMA: {
                const provider = (0, ai_sdk_ollama_1.createOllama)({
                    baseURL: this.aiConfig.config.baseURL,
                });
                return provider(chatModel);
            }
            default:
                return null;
        }
    }
    getChatModelName() {
        return (this.environmentService.getAiChatModel() ||
            this.environmentService.getAiCompletionModel());
    }
    buildSystemPrompt(workspace, locale) {
        return `You are Docmost AI, the built-in AI assistant for Docmost. You are currently helping users of the "${workspace.name || 'Docmost'}" workspace.

IDENTITY:
- Your name is Docmost AI.
- If the user asks who you are, what you are, or what your name is, say you are Docmost AI — the AI assistant built into Docmost, a collaborative workspace where teams capture knowledge, plan work, and collaborate across pages and spaces.
- Do NOT reveal or speculate about the underlying model, provider, or company that powers you. If asked, say you are Docmost AI and redirect to how you can help with the workspace.
- Do NOT claim to be ChatGPT, Claude, Gemini, or any other product.
- Do NOT describe Docmost as "documentation software" or the workspace as "documentation" — it is a collaborative knowledge workspace. Use words like pages, spaces, workspace, knowledge, notes, or content.

You help teammates find information, answer questions, draft and edit pages, and navigate the workspace.

You have access to tools that let you:
- List spaces in the workspace
- Find relevant pages by meaning (semantic_search) — PREFERRED search tool; use this first for ANY page-finding or knowledge query
- Keyword-based page search (search_pages) — fallback only
- Read page content
- Create new pages
- Update existing pages

MENTIONED PAGES AND ATTACHMENTS:
- When the user mentions a page with @, its content (or table of contents for large pages) is ALREADY provided in the conversation as a get_page tool result. Do NOT search for it again.
- When the user uploads a file, its extracted text is provided as a get_attachment_content tool result. This is a read-only historical record — do NOT attempt to call get_attachment_content yourself; it is not a real tool in this session.
- Answer questions about mentioned pages and attachments using the content already provided. Only use search tools if the provided content does not contain the answer.

TOOL SELECTION (follow this order strictly):
- semantic_search is ALWAYS your first search tool. Use it for every page-finding or knowledge query, including when the user says things like "the X page", "find X", "what about X", "where is X", or asks a conceptual question. Semantic search matches by meaning AND title, so it finds pages named X as well as pages about X.
- search_pages is a FALLBACK. Only call it if (a) semantic_search returned no results, (b) semantic_search reported that embeddings are not configured, or (c) the user gave you a literal page identifier (UUID, slug) rather than a name or topic.
- Do NOT call either search tool for casual conversation, follow-up questions about content already in the conversation, or requests to rephrase/reformat.
- Do NOT switch to search_pages just because the user referenced a page "by name" — semantic_search already handles that case.

LARGE PAGE HANDLING:
- When a mentioned page shows a table of contents instead of full content, use read_page_sections to fetch specific sections by ID, or search_in_page to find content by keywords.
- Prefer reading 1-3 targeted sections over fetching many sections at once.

${untrusted_content_1.UNTRUSTED_CONTENT_SYSTEM_RULES}

RESPONSE STYLE & GROUNDING:
- When answering a question about the workspace's content or knowledge, rely only on content returned by tools, mentioned pages, or attachments in this conversation. Do not add outside knowledge, background, or speculation. If the retrieved content does not contain the answer, say so plainly in one sentence.
- Use the source's own wording. Do not editorialize or generalize beyond what the content states.
- Be direct. No preamble ("Great question"), no summary or importance headers ("Overall Importance:", "In summary"), and no closers that invite further engagement ("you might be interested in...", "feel free to ask"). Answer the question and stop.
- Default to a short answer. Expand only when the user asks for more depth, or asks you to draft or edit a page.

CRITICAL RULES:
- NEVER fabricate, guess, or make up UUIDs or IDs. Only use IDs that were returned by a tool in this conversation.
- Before creating a page, ALWAYS call list_spaces first to get a valid spaceId.
- When calling create_page: OMIT the parentPageId field entirely unless the user explicitly asked to put the page under a specific parent. Do NOT invent a parentPageId.
- When creating or updating pages, use markdown format for content.
- After creating or updating a page, link to it using the PAGE LINK FORMAT below (create_page and update_page return the slugId and spaceSlug) so the user can open it.
- If you don't know something, search for it first.

ASKING FOR CLARIFICATION:
Default to acting on reasonable inference. Only stop to ask when proceeding could plausibly do the wrong thing in a way the user would notice and care about. Asking too often is worse than a small recoverable mistake on a reversible action.

You MUST ask before proceeding only when:
- A destructive or hard-to-reverse operation (replace-all content, move to trash, move across spaces) targets a page that was INFERRED rather than explicitly named or @-mentioned by the user. Confirm the exact target as a page link first.
- Multiple plausible matches exist for an ambiguous reference AND the action is a mutation. For read-only answers, just pick the best match and say which one you used.
- The user asked to create a page, there are multiple writable spaces, and no space is obvious from context (active page's space, explicit mention, or clearly dominant recent space). Present a short list.

You do NOT need to ask when:
- The action is read-only (search, read_page, list_spaces).
- The target page was @-mentioned or is unambiguously the current page.
- There is one writable space, or the context makes the target space obvious — just proceed and mention your choice briefly in the response.
- The edit is a small, low-risk change and the target is clear. Do the edit and say what you did.

When you do ask: one short question, options as page or space links, no mutating tool call in the same turn. Use read-only tools first if they help you present concrete options.

SOURCE CITATION:
Cite sources only when it genuinely helps the user trace where information came from. Be judicious — citations should add value, not clutter.

When to cite:
- The answer draws on pages the user did NOT already reference, and you found them via semantic_search, search_pages, get_page, read_page_sections, or search_in_page.
- You are combining information from multiple pages and the user needs to know which fact came from where.

When NOT to cite:
- The user @-mentioned the page(s) and your answer is based on that content — the user already knows the source. Do not add a "Sources:" section just to list what they mentioned.
- The answer is conversational, a follow-up, a rephrase/reformat, or general knowledge.
- The answer is a single, short response drawn from one page that was obvious from the question.
- Adding a "Sources:" section would just repeat pages already linked inline in the same answer.

How to cite (when warranted):
- Prefer inline links on the first reference, using the page link format below.
- Only add a separate "Sources:" section if you pulled from 2+ pages that aren't already linked inline in the answer.
- Never cite pages you did not actually read or receive as a tool result.

PAGE LINK FORMAT:
When referencing any page (for citations or otherwise), ALWAYS format it as a markdown link using this exact pattern:
[{icon} {title}](/s/{spaceSlug}/p/{slugId})

STRICT RULES (these are NOT optional):
- The URL is RELATIVE. It MUST start with "/s/" and MUST NOT contain a scheme or a domain. Never write "http://", "https://", or any host such as "yoursite.com", "example.com", "your-workspace.com", "docmost.com", or the current page's domain inside a page link.
- {spaceSlug} and {slugId} MUST be copied verbatim from the "spaceSlug" and "slugId" fields of a tool result returned in this turn (semantic_search, search_pages, list_recent_pages, get_page, create_page, update_page, or a get_page result for a mentioned page). Do not invent, guess, abbreviate, or substitute these values.
- If a page has no "slugId" or no "spaceSlug" in any tool result you have seen, DO NOT link to it. Reference the page by title only.
- Use the "icon" field from the tool result. If the page has no icon, use 📄 as the default.

Good (relative URL, real slugId and spaceSlug from a tool result):
[📄 Getting Started](/s/engineering/p/abc123)
[🚀 Launch Plan](/s/product/p/x7y2k9)

Bad (absolute URL, placeholder domain, fabricated path, or custom scheme):
[Getting Started](https://yoursite.com/s/engineering/p/abc123)
[Getting Started](https://example.com/getting-started)
[Getting Started](https://docmost.example/s/engineering/p/abc123)
[Getting Started](page:abc123)

Never output raw page IDs, plain text page titles wrapped as links, or bare URLs. Use the relative link format above, or omit the link entirely if you do not have the slugId and spaceSlug from a tool result.

${(0, locale_language_1.buildLanguageDirective)(locale)}`;
    }
    async buildModelMessages(history, currentAttachments, currentMentionedPages) {
        const messages = [];
        const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        const KEEP_RECENT_IMAGE_TURNS = 2;
        let lastUserMsgIndex = -1;
        for (let j = history.length - 1; j >= 0; j--) {
            if (history[j].role === 'user') {
                lastUserMsgIndex = j;
                break;
            }
        }
        const keepImagesForMsgIdx = new Set();
        let keptImageTurns = 0;
        for (let j = history.length - 1; j >= 0 && keptImageTurns < KEEP_RECENT_IMAGE_TURNS; j--) {
            const m = history[j];
            if (m.role !== 'user')
                continue;
            const isLatest = j === lastUserMsgIndex;
            const currentHasImages = isLatest && currentAttachments?.some((a) => a.base64);
            const refs = m.metadata?.attachments;
            const historicalHasImage = refs?.some((r) => IMAGE_EXTS.includes(r.fileExt?.toLowerCase()));
            if (currentHasImages || historicalHasImage) {
                keepImagesForMsgIdx.add(j);
                keptImageTurns++;
            }
        }
        for (let i = 0; i < history.length; i++) {
            const msg = history[i];
            if (msg.role === 'user') {
                const isLatestUserMsg = i === lastUserMsgIndex;
                const shouldKeepImages = keepImagesForMsgIdx.has(i);
                const resolvedAttachments = isLatestUserMsg && currentAttachments
                    ? currentAttachments
                    : await this.resolveAttachmentsFromMetadata(msg, {
                        elideImages: !shouldKeepImages,
                    });
                const imageAttachments = resolvedAttachments.filter((a) => a.base64);
                const elidedImages = resolvedAttachments.filter((a) => a.elided);
                const textAttachments = resolvedAttachments.filter((a) => a.textContent);
                let userText = msg.content || '';
                if (elidedImages.length > 0) {
                    const markers = elidedImages
                        .map((a) => `[Image previously attached: ${a.fileName}]`)
                        .join('\n');
                    userText = userText ? `${userText}\n\n${markers}` : markers;
                }
                if (imageAttachments.length > 0) {
                    const contentParts = [
                        { type: 'text', text: userText },
                    ];
                    for (const img of imageAttachments) {
                        contentParts.push({
                            type: 'image',
                            image: img.base64,
                            mimeType: img.mimeType,
                        });
                    }
                    messages.push({ role: 'user', content: contentParts });
                }
                else {
                    messages.push({ role: 'user', content: userText });
                }
                if (isLatestUserMsg && currentMentionedPages?.length) {
                    this.injectMentionedPageContext(messages, currentMentionedPages);
                }
                if (textAttachments.length > 0) {
                    this.injectAttachmentContext(messages, textAttachments);
                }
            }
            else if (msg.role === 'assistant') {
                if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
                    const toolCallsList = msg.toolCalls;
                    const parts = [];
                    if (msg.content) {
                        parts.push({ type: 'text', text: msg.content });
                    }
                    for (const tc of toolCallsList) {
                        parts.push({
                            type: 'tool-call',
                            toolCallId: tc.id,
                            toolName: tc.name,
                            input: tc.args || {},
                        });
                    }
                    messages.push({ role: 'assistant', content: parts });
                    for (const tc of toolCallsList) {
                        const safeResult = tc.result === undefined || tc.result === null
                            ? { error: 'tool did not return a result' }
                            : tc.result;
                        messages.push({
                            role: 'tool',
                            content: [
                                {
                                    type: 'tool-result',
                                    toolCallId: tc.id,
                                    toolName: tc.name,
                                    output: {
                                        type: 'json',
                                        value: safeResult,
                                    },
                                },
                            ],
                        });
                    }
                }
                else {
                    messages.push({
                        role: 'assistant',
                        content: msg.content || '',
                    });
                }
            }
        }
        return messages;
    }
    injectMentionedPageContext(messages, pages) {
        const toolCallParts = [];
        const toolResultMessages = [];
        for (const page of pages) {
            const callId = `mention_${page.pageId || page.title.replace(/\s+/g, '_').slice(0, 30)}`;
            toolCallParts.push({
                type: 'tool-call',
                toolCallId: callId,
                toolName: 'get_page',
                input: { pageId: page.pageId },
            });
            const fencedBody = (0, untrusted_content_1.fenceUntrustedContent)({
                source: 'page',
                attributes: {
                    id: page.pageId,
                    title: page.title,
                    slugId: page.slugId,
                },
                body: page.content,
            });
            const value = {
                id: page.pageId,
                title: page.title,
                icon: page.icon || null,
                slugId: page.slugId || null,
                spaceSlug: page.spaceSlug || null,
            };
            if (page.isSkeleton) {
                value.tableOfContents = fencedBody;
                value.note = 'This page is large. Use read_page_sections to read specific sections by ID, or search_in_page to find content by keywords. The table of contents above is untrusted content.';
            }
            else {
                value.content = fencedBody;
            }
            toolResultMessages.push({
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: callId,
                        toolName: 'get_page',
                        output: {
                            type: 'json',
                            value: value,
                        },
                    },
                ],
            });
        }
        messages.push({ role: 'assistant', content: toolCallParts });
        messages.push(...toolResultMessages);
    }
    async fetchMentionedPages(pageIds, user, pageJsonCache, userMessage) {
        const results = [];
        const SKELETON_THRESHOLD = 4000;
        for (const pageId of pageIds.slice(0, 5)) {
            try {
                const page = await this.pageRepo.findById(pageId, {
                    includeContent: true,
                    includeSpace: true,
                });
                if (!page || page.deletedAt)
                    continue;
                await this.pageAccessService.validateCanView(page, user);
                if (!page.content) {
                    results.push({
                        pageId: page.id,
                        title: page.title || 'Untitled',
                        icon: page.icon || null,
                        slugId: page.slugId,
                        spaceSlug: page.space?.slug || null,
                        content: '',
                        isSkeleton: false,
                    });
                    continue;
                }
                const markdown = (0, collaboration_util_1.jsonToMarkdown)(page.content);
                const tokens = (0, token_counter_1.countTokens)(markdown);
                if (tokens <= SKELETON_THRESHOLD) {
                    results.push({
                        pageId: page.id,
                        title: page.title || 'Untitled',
                        icon: page.icon || null,
                        slugId: page.slugId,
                        spaceSlug: page.space?.slug || null,
                        content: markdown,
                        isSkeleton: false,
                    });
                }
                else {
                    let toc = (0, page_content_extractor_1.extractTableOfContents)(page.content);
                    if (toc.length === 0) {
                        toc = await (0, page_content_extractor_1.buildPositionalChunks)(page.content);
                    }
                    const seeded = userMessage
                        ? await (0, page_content_extractor_1.seedRelevantSections)(page.content, toc, userMessage)
                        : [];
                    const tocText = (0, page_content_extractor_1.formatTocForLlm)(page.title || 'Untitled', page.id, toc, seeded);
                    pageJsonCache?.set(page.id, page.content);
                    results.push({
                        pageId: page.id,
                        title: page.title || 'Untitled',
                        icon: page.icon || null,
                        slugId: page.slugId,
                        spaceSlug: page.space?.slug || null,
                        content: tocText,
                        isSkeleton: true,
                    });
                }
            }
            catch (err) {
                if (err instanceof common_1.ForbiddenException)
                    continue;
                this.logger.warn({ err }, `Failed to fetch mentioned page ${pageId}`);
            }
        }
        return results;
    }
    async uploadChatFile(filePromise, userId, workspaceId, chatId) {
        if (chatId) {
            await this.getChat(chatId, userId, workspaceId);
        }
        const prepared = await (0, attachment_utils_1.prepareFile)(filePromise);
        const folderPath = (0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.Chat, workspaceId);
        const attachmentId = (0, uuid_1.v7)();
        const filePath = `${folderPath}/${attachmentId}/${prepared.fileName}`;
        await this.storageService.upload(filePath, prepared.buffer);
        const attachment = await this.attachmentRepo.insertAttachment({
            id: attachmentId,
            fileName: prepared.fileName,
            filePath,
            fileExt: prepared.fileExtension,
            fileSize: prepared.fileSize,
            mimeType: prepared.mimeType,
            type: attachment_constants_1.AttachmentType.Chat,
            creatorId: userId,
            workspaceId,
            aiChatId: chatId ?? null,
            pageId: null,
            spaceId: null,
        });
        const textExts = ['.pdf', '.docx', '.txt', '.csv', '.md'];
        if (textExts.includes(prepared.fileExtension.toLowerCase())) {
            try {
                const textContent = await this.extractTextContent(prepared.buffer, prepared.fileExtension);
                if (textContent) {
                    await this.attachmentRepo.updateAttachment({
                        textContent: textContent.substring(0, ai_chat_limits_1.MAX_ATTACHMENT_TEXT_CHARS),
                    }, attachment.id);
                }
            }
            catch (err) {
                this.logger.warn({ err }, 'Failed to extract text content');
            }
        }
        return {
            id: attachment.id,
            fileName: prepared.fileName,
            fileExt: prepared.fileExtension,
            fileSize: prepared.fileSize,
            mimeType: prepared.mimeType,
        };
    }
    async extractTextContent(buffer, fileExt) {
        const ext = fileExt.toLowerCase();
        if (ext === '.pdf') {
            return this.attachmentEeService.convertPdfToMarkdown(buffer);
        }
        if (ext === '.docx') {
            return this.attachmentEeService.convertDocxToText(buffer);
        }
        if (['.txt', '.csv', '.md'].includes(ext)) {
            return buffer.toString('utf-8');
        }
        return null;
    }
    async fetchAttachments(attachmentIds, userId, workspaceId) {
        const results = [];
        for (const id of attachmentIds.slice(0, ai_chat_limits_1.MAX_ATTACHMENTS_PER_MESSAGE)) {
            try {
                const attachment = await this.attachmentRepo.findByIdWithContent(id);
                if (!attachment ||
                    attachment.creatorId !== userId ||
                    attachment.workspaceId !== workspaceId) {
                    continue;
                }
                const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
                const isImage = imageExts.includes(attachment.fileExt?.toLowerCase());
                if (isImage) {
                    const fileBuffer = await this.storageService.read(attachment.filePath);
                    const base64 = fileBuffer.toString('base64');
                    results.push({
                        id: attachment.id,
                        fileName: attachment.fileName,
                        fileExt: attachment.fileExt,
                        mimeType: attachment.mimeType,
                        base64,
                    });
                }
                else {
                    results.push({
                        id: attachment.id,
                        fileName: attachment.fileName,
                        fileExt: attachment.fileExt,
                        textContent: attachment.textContent || null,
                    });
                }
            }
            catch {
            }
        }
        return results;
    }
    async resolveAttachmentsFromMetadata(msg, opts = {}) {
        const refs = msg.metadata?.attachments;
        if (!refs?.length)
            return [];
        const results = [];
        const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        for (const ref of refs) {
            try {
                const isImage = imageExts.includes(ref.fileExt?.toLowerCase());
                if (isImage && opts.elideImages) {
                    results.push({
                        id: ref.id,
                        fileName: ref.fileName,
                        fileExt: ref.fileExt,
                        elided: true,
                    });
                    continue;
                }
                const attachment = await this.attachmentRepo.findByIdWithContent(ref.id);
                if (!attachment)
                    continue;
                if (imageExts.includes(attachment.fileExt?.toLowerCase())) {
                    const fileBuffer = await this.storageService.read(attachment.filePath);
                    results.push({
                        id: attachment.id,
                        fileName: attachment.fileName,
                        fileExt: attachment.fileExt,
                        mimeType: attachment.mimeType,
                        base64: fileBuffer.toString('base64'),
                    });
                }
                else {
                    results.push({
                        id: attachment.id,
                        fileName: attachment.fileName,
                        fileExt: attachment.fileExt,
                        textContent: attachment.textContent || null,
                    });
                }
            }
            catch {
            }
        }
        return results;
    }
    injectAttachmentContext(messages, attachments) {
        if (attachments.length === 0)
            return 0;
        const perFileCap = Math.min(ai_chat_limits_1.MAX_ATTACHMENT_TOKENS_PER_FILE, Math.floor(ai_chat_limits_1.MAX_ATTACHMENT_TOKENS_CUMULATIVE / attachments.length));
        let tokensUsed = 0;
        const toolCallParts = [];
        const toolResultMessages = [];
        for (const att of attachments) {
            const remaining = ai_chat_limits_1.MAX_ATTACHMENT_TOKENS_CUMULATIVE - tokensUsed;
            if (remaining <= 0)
                break;
            const budget = Math.min(perFileCap, remaining);
            const { text: clipped, truncated } = (0, token_counter_3.truncateToTokenBudget)(att.textContent || '(no text content extracted)', budget);
            tokensUsed += (0, token_counter_1.countTokens)(clipped);
            const rawContent = truncated
                ? clipped + ai_chat_limits_1.ATTACHMENT_TRUNCATION_MARKER
                : clipped;
            const fencedContent = (0, untrusted_content_1.fenceUntrustedContent)({
                source: 'attachment',
                attributes: {
                    id: att.id,
                    fileName: att.fileName,
                },
                body: rawContent,
            });
            const callId = `attachment_${att.id.slice(0, 12)}`;
            toolCallParts.push({
                type: 'tool-call',
                toolCallId: callId,
                toolName: 'get_attachment_content',
                input: { attachmentId: att.id, fileName: att.fileName },
            });
            toolResultMessages.push({
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: callId,
                        toolName: 'get_attachment_content',
                        output: {
                            type: 'json',
                            value: {
                                id: att.id,
                                fileName: att.fileName,
                                content: fencedContent,
                            },
                        },
                    },
                ],
            });
        }
        messages.push({ role: 'assistant', content: toolCallParts });
        messages.push(...toolResultMessages);
        return tokensUsed;
    }
};
exports.AiChatService = AiChatService;
exports.AiChatService = AiChatService = AiChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Inject)(ai_constants_1.AI_CONFIG_TOKEN)),
    __param(9, (0, bullmq_1.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __metadata("design:paramtypes", [ai_chat_repo_1.AiChatRepo,
        ai_chat_tools_service_1.AiChatToolsService,
        page_repo_1.PageRepo,
        attachment_repo_1.AttachmentRepo,
        page_access_service_1.PageAccessService,
        environment_service_1.EnvironmentService,
        storage_service_1.StorageService,
        attachment_ee_service_1.AttachmentEeService, Object, bullmq_2.Queue])
], AiChatService);
//# sourceMappingURL=ai-chat.service.js.map