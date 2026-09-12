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
var AiSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiSearchService = void 0;
const common_1 = require("@nestjs/common");
const textsplitters_1 = require("@langchain/textsplitters");
const environment_service_1 = require("../../../integrations/environment/environment.service");
const page_embeddings_repo_1 = require("../repos/page-embeddings.repo");
const page_repo_1 = require("../../../database/repos/page/page.repo");
const utils_1 = require("../../../database/utils");
const nestjs_kysely_1 = require("nestjs-kysely");
const pgvector = require("pgvector/kysely");
const kysely_1 = require("pgvector/kysely");
const kysely_2 = require("kysely");
const space_member_repo_1 = require("../../../database/repos/space/space-member.repo");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const ai_service_1 = require("./ai.service");
const ai_constants_1 = require("../ai.constants");
const locale_language_1 = require("../utils/locale-language");
let AiSearchService = AiSearchService_1 = class AiSearchService {
    constructor(aiService, environmentService, pageEmbeddingsRepo, pageRepo, spaceMemberRepo, pagePermissionRepo, db) {
        this.aiService = aiService;
        this.environmentService = environmentService;
        this.pageEmbeddingsRepo = pageEmbeddingsRepo;
        this.pageRepo = pageRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.db = db;
        this.logger = new common_1.Logger(AiSearchService_1.name);
        this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 5500,
            chunkOverlap: 200,
            separators: [
                '\n\n',
                '\n',
                '. ',
                ', ',
                ' ',
                '',
            ],
        });
    }
    async searchSimilarPages(searchParams, opts) {
        const { query } = searchParams;
        const searchQuery = query ? query.trim() : '';
        if (!searchQuery || searchQuery.length < 1) {
            return [];
        }

        const stopWords = new Set([
            'có', 'nào', 'ko', 'không', 'gì', 'là', 'cho', 'tôi', 'xin', 'ở', 'đâu',
            'này', 'của', 'và', 'với', 'các', 'được', 'hãy', 'làm', 'sao', 'thế', 'ạ',
            'nhé', 'em', 'anh', 'bạn', 'mình', 'những', 'cái', 'thì', 'ra', 'về', 'trong',
            'is', 'are', 'the', 'a', 'an', 'what', 'how', 'where', 'who', 'any'
        ]);
        const words = searchQuery
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 1 && !stopWords.has(w));

        let pagesQuery = this.db
            .selectFrom('pages as p')
            .innerJoin('spaces as s', 's.id', 'p.spaceId')
            .select([
                'p.id as pageId',
                'p.spaceId',
                'p.title',
                'p.slugId',
                'p.textContent',
                's.slug as spaceSlug',
            ])
            .where('p.workspaceId', '=', opts.workspaceId)
            .where('p.deletedAt', 'is', null);

        if (searchParams?.spaceId) {
            pagesQuery = pagesQuery.where('p.spaceId', '=', searchParams.spaceId);
        } else {
            pagesQuery = pagesQuery.where('p.spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId));
        }

        if (words.length > 0) {
            pagesQuery = pagesQuery.where((eb) => {
                const conditions = [
                    eb('p.title', 'ilike', '%' + searchQuery + '%'),
                    eb('p.textContent', 'ilike', '%' + searchQuery + '%'),
                ];
                for (const w of words) {
                    conditions.push(eb('p.title', 'ilike', '%' + w + '%'));
                    conditions.push(eb('p.textContent', 'ilike', '%' + w + '%'));
                }
                return eb.or(conditions);
            });
        }

        let matchedPages = await pagesQuery.limit(10).execute();

        // Fallback: Nếu không tìm thấy trang theo từ khóa, lấy danh sách trang gần đây của workspace
        if (!matchedPages || matchedPages.length === 0) {
            let fallbackQuery = this.db
                .selectFrom('pages as p')
                .innerJoin('spaces as s', 's.id', 'p.spaceId')
                .select([
                    'p.id as pageId',
                    'p.spaceId',
                    'p.title',
                    'p.slugId',
                    'p.textContent',
                    's.slug as spaceSlug',
                ])
                .where('p.workspaceId', '=', opts.workspaceId)
                .where('p.deletedAt', 'is', null);
            if (searchParams?.spaceId) {
                fallbackQuery = fallbackQuery.where('p.spaceId', '=', searchParams.spaceId);
            } else {
                fallbackQuery = fallbackQuery.where('p.spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId));
            }
            matchedPages = await fallbackQuery.limit(5).execute();
        }

        if (matchedPages && matchedPages.length > 0) {
            const pageIds = [...new Set(matchedPages.map((p) => p.pageId))];
            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds,
                userId: opts.userId,
            });
            const accessibleSet = new Set(accessibleIds);
            matchedPages = matchedPages.filter((p) => accessibleSet.has(p.pageId));
        }

        return (matchedPages || []).map((p, idx) => ({
            id: 'search-' + p.pageId + '-' + idx,
            pageId: p.pageId,
            spaceId: p.spaceId,
            workspaceId: opts.workspaceId,
            chunkIndex: 0,
            chunkStart: 0,
            chunkLength: Math.min((p.textContent || '').length, 3000),
            metadata: {},
            title: p.title,
            slugId: p.slugId,
            spaceSlug: p.spaceSlug,
            distance: 0.1,
            similarity: 0.9,
        }));
    }
    async askAiSearch(searchParams, opts) {
        const { userId, workspaceId, locale } = opts;
        const { query } = searchParams;
        if (!this.aiService.isDriverConfigured()) {
            throw new common_1.BadRequestException('AI driver is not configured');
        }
        const languageDirective = (0, locale_language_1.buildLanguageDirective)(locale);
        const defaultLanguage = (0, locale_language_1.languageFromLocale)(locale);
        const systemPrompt = 'Bạn là HQL Global AI, trợ lý AI thông minh tích hợp cho không gian làm việc HQL Global.' +
            ' Nhiệm vụ của bạn là giải đáp câu hỏi của người dùng dựa trên thông tin tài liệu trong không gian làm việc.' +
            ' Nếu tài liệu có thông tin liên quan, hãy trả lời chính xác, trích dẫn rõ ràng.' +
            ' Nếu trong tài liệu không có thông tin người dùng tìm, hãy tóm tắt các tài liệu hiện có trong không gian làm việc và hỗ trợ giải đáp một cách hữu ích nhất.' +
            ' Luôn luôn trả lời bằng Tiếng Việt.' +
            `\n\n${languageDirective}`;

        const searchResults = await this.searchSimilarPages(searchParams, {
            userId,
            workspaceId,
        });

        let validChunks = [];
        let sources = [];
        if (searchResults && searchResults.length > 0) {
            const pageIds = [...new Set(searchResults.map((r) => r.pageId))];
            const pages = await this.db
                .selectFrom('pages')
                .select(['id', 'textContent'])
                .where('id', 'in', pageIds)
                .execute();
            const pageContentMap = new Map(pages.map((p) => [p.id, p.textContent]));
            validChunks = searchResults
                .map((result) => {
                    const pageContent = pageContentMap.get(result.pageId);
                    if (!pageContent)
                        return null;
                    const chunkText = pageContent.substring(result.chunkStart, result.chunkStart + result.chunkLength);
                    return {
                        pageId: result.pageId,
                        title: result.title,
                        slugId: result.slugId,
                        spaceSlug: result.spaceSlug,
                        chunkText,
                        distance: result.distance,
                        similarity: result.similarity,
                        chunkIndex: result.chunkIndex,
                    };
                })
                .filter((chunk) => chunk !== null && chunk.chunkText.length > 0);

            sources = validChunks.map((chunk) => ({
                pageId: chunk.pageId,
                title: chunk.title,
                slugId: chunk.slugId,
                spaceSlug: chunk.spaceSlug,
                similarity: chunk.similarity,
                distance: chunk.distance,
                chunkIndex: chunk.chunkIndex,
                excerpt: chunk.chunkText.substring(0, 200) +
                    (chunk.chunkText.length > 200 ? '...' : ''),
            }));
        }

        let contextText = '';
        if (validChunks.length > 0) {
            contextText = validChunks
                .map((chunk) => `[Tài liệu: ${chunk.title}]\n${chunk.chunkText}\n`)
                .join('\n---\n');
        } else {
            contextText = '(Không gian làm việc hiện tại chưa có tài liệu nào)';
        }

        const userPrompt = `Ngữ cảnh tài liệu từ không gian làm việc HQL Global:
${contextText}

Câu hỏi của người dùng: ${query}

Hãy trả lời câu hỏi của người dùng một cách chính xác, tự nhiên và thân thiện.
Nếu thông tin có trong tài liệu ở trên, hãy trả lời chi tiết và nêu rõ tài liệu liên quan.
Nếu tài liệu không đề cập đến nội dung người dùng hỏi, hãy cho người dùng biết nội dung tài liệu hiện có trong không gian làm việc và hỗ trợ tốt nhất có thể.
Luôn trả lời bằng Tiếng Việt.`;

        try {
            const stream = await this.aiService.generateCompletionStream({
                systemPrompt,
                userPrompt,
                temperature: 0.3,
                maxTokens: ai_constants_1.DEFAULT_AI_CONFIG.maxTokens,
                stream: true,
            });
            return {
                stream,
                sources,
            };
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to generate AI search response');
            throw new common_1.BadRequestException('Failed to generate AI search response. Please try again later.');
        }
    }
    async generatePageEmbeddings(pageId) {
        if (!this.aiService.isDriverConfigured())
            return;
        const page = await this.pageRepo.findById(pageId, {
            includeTextContent: true,
        });
        if (!page || page.deletedAt)
            return;
        const workspace = await this.db
            .selectFrom('workspaces')
            .select(['id', 'settings'])
            .where('id', '=', page.workspaceId)
            .executeTakeFirst();
        const isAiSearchEnabled = workspace?.settings?.['ai']?.['search'] === true;
        if (!isAiSearchEnabled)
            return;
        if (!page?.textContent || page.textContent.length < 200)
            return;
        const pageText = this.preparePageText(page);
        const documents = await this.textSplitter.createDocuments([pageText], [{ pageId: page.id, title: page.title }]);
        this.logger.debug(`Split page ${page.id} into ${documents.length} chunks`);
        const embeddings = await this.aiService.generateEmbeddingsBatch(documents.map((doc) => doc.pageContent));
        const titlePrefixLength = page.title?.trim()
            ? `# ${page.title}\n\n`.length
            : 0;
        const embeddingsToStore = this.buildEmbeddingsToStore({
            documents,
            embeddings,
            page,
            pageText,
            titlePrefixLength,
        });
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            await this.pageEmbeddingsRepo.deleteByPageId(page.id, { trx });
            await this.pageEmbeddingsRepo.insertPageEmbeddingBatch(embeddingsToStore, { trx });
            this.logger.debug(`Stored ${embeddingsToStore.length} embeddings for page ${page.id}`);
        });
    }
    preparePageText(page) {
        let text = page.textContent;
        if (page.title?.trim()) {
            text = `# ${page.title}\n\n${text}`;
        }
        const MAX_TEXT_LENGTH = 100000;
        if (text.length > MAX_TEXT_LENGTH) {
            this.logger.debug(`Page ${page.id} text truncated from ${text.length} to ${MAX_TEXT_LENGTH}`);
            text = text.substring(0, MAX_TEXT_LENGTH);
        }
        return text.replace(/\n{2,}/g, '\n\n');
    }
    buildEmbeddingsToStore(opts) {
        const { embeddings, documents, page, pageText, titlePrefixLength } = opts;
        let currentPosition = 0;
        return documents.map((doc, i) => {
            const chunkStartInModified = pageText.indexOf(doc.pageContent, currentPosition);
            const chunkLength = doc.pageContent.length;
            const chunkStart = Math.max(0, chunkStartInModified - titlePrefixLength);
            currentPosition = chunkStartInModified + chunkLength - 200;
            return {
                pageId: page.id,
                embedding: pgvector.toSql(embeddings[i]),
                modelName: this.environmentService.getAiEmbeddingModel(),
                chunkIndex: i,
                chunkStart,
                chunkLength,
                metadata: {
                    title: page.title,
                    totalChunks: documents.length,
                },
                spaceId: page.spaceId,
                workspaceId: page.workspaceId,
            };
        });
    }
};
exports.AiSearchService = AiSearchService;
exports.AiSearchService = AiSearchService = AiSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        environment_service_1.EnvironmentService,
        page_embeddings_repo_1.PageEmbeddingsRepo,
        page_repo_1.PageRepo,
        space_member_repo_1.SpaceMemberRepo,
        page_permission_repo_1.PagePermissionRepo, Object])
], AiSearchService);
//# sourceMappingURL=ai-search.service.js.map