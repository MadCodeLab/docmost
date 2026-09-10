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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatToolsService = void 0;
const common_1 = require("@nestjs/common");
const ai_1 = require("ai");
const v4_1 = require("zod/v4");
const page_service_1 = require("../../core/page/services/page.service");
const page_repo_1 = require("../../database/repos/page/page.repo");
const space_repo_1 = require("../../database/repos/space/space.repo");
const space_member_service_1 = require("../../core/space/services/space-member.service");
const page_access_service_1 = require("../../core/page/page-access/page-access.service");
const search_service_1 = require("../../core/search/search.service");
const space_ability_factory_1 = require("../../core/casl/abilities/space-ability.factory");
const environment_service_1 = require("../../integrations/environment/environment.service");
const page_search_service_1 = require("../typesense/services/page-search.service");
const ai_search_service_1 = require("../ai/services/ai-search.service");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const space_ability_type_1 = require("../../core/casl/interfaces/space-ability.type");
const common_2 = require("@nestjs/common");
const collaboration_util_1 = require("../../collaboration/collaboration.util");
const page_content_extractor_1 = require("./utils/page-content-extractor");
const token_counter_1 = require("./utils/token-counter");
const untrusted_content_1 = require("./utils/untrusted-content");
const fabricated_id_1 = require("./utils/fabricated-id");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const search_dto_1 = require("../../core/search/dto/search.dto");
let AiChatToolsService = class AiChatToolsService {
    constructor(pageRepo, spaceRepo, spaceMemberService, pageService, pageAccessService, searchService, spaceAbility, environmentService, pageSearchService, aiSearchService, pagePermissionRepo) {
        this.pageRepo = pageRepo;
        this.spaceRepo = spaceRepo;
        this.spaceMemberService = spaceMemberService;
        this.pageService = pageService;
        this.pageAccessService = pageAccessService;
        this.searchService = searchService;
        this.spaceAbility = spaceAbility;
        this.environmentService = environmentService;
        this.pageSearchService = pageSearchService;
        this.aiSearchService = aiSearchService;
        this.pagePermissionRepo = pagePermissionRepo;
    }
    createTools(user, workspace, pageJsonCache, userMessage) {
        return {
            list_spaces: (0, ai_1.tool)({
                description: 'List all spaces the user has access to. Always call this first before creating pages to get valid space IDs.',
                inputSchema: v4_1.z.object({}),
                execute: async () => {
                    try {
                        const pagination = Object.assign(new pagination_options_1.PaginationOptions(), {
                            limit: 25,
                        });
                        const result = await this.spaceMemberService.getUserSpaces(user.id, pagination);
                        const spaces = (result.items || []).map((s) => ({
                            id: s.id,
                            name: s.name,
                            slug: s.slug,
                            description: s.description,
                        }));
                        return { spaces };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            get_space: (0, ai_1.tool)({
                description: 'Get details about a specific space by ID or slug, including its name, description, and settings.',
                inputSchema: v4_1.z.object({
                    spaceId: v4_1.z.string().describe('Space ID (UUID) or slug'),
                }),
                execute: async (args) => {
                    try {
                        const space = await this.spaceRepo.findById(args.spaceId, workspace.id);
                        if (!space) {
                            return { error: 'Space not found' };
                        }
                        try {
                            const ability = await this.spaceAbility.createForUser(user, space.id);
                            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Settings)) {
                                return { error: 'Space not found' };
                            }
                        }
                        catch {
                            return { error: 'Space not found' };
                        }
                        return {
                            id: space.id,
                            name: space.name,
                            slug: space.slug,
                            description: space.description,
                            visibility: space.visibility,
                            createdAt: space.createdAt,
                        };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            semantic_search: (0, ai_1.tool)({
                description: "PREFERRED search tool. Finds documentation content semantically relevant to a topic, concept, or question using vector embeddings — matches by meaning, not just keywords. This should be your FIRST choice whenever the user asks about any topic, concept, feature, process, or piece of knowledge that might be documented. Works even when the user's wording doesn't match the exact words in the pages. Do NOT use for casual conversation, rephrasing, or when the user has already provided all necessary context. If this tool returns an error that semantic search is not configured, or returns no results, THEN fall back to search_pages.",
                inputSchema: v4_1.z.object({
                    query: v4_1.z
                        .string()
                        .describe('A natural language description of what information you need. Be specific — e.g. "how user authentication works" rather than "auth".'),
                    limit: v4_1.z
                        .number()
                        .int()
                        .min(1)
                        .max(10)
                        .optional()
                        .default(5)
                        .describe('Maximum number of relevant chunks to return'),
                }),
                execute: async (args) => {
                    try {
                        if (!this.environmentService.getAiEmbeddingModel()?.length) {
                            return {
                                error: 'Semantic search is not configured. Use search_pages instead.',
                            };
                        }
                        const searchDto = Object.assign(new search_dto_1.SearchDTO(), {
                            query: args.query,
                            limit: args.limit,
                            offset: 0,
                        });
                        const results = await this.aiSearchService.searchSimilarPages(searchDto, { userId: user.id, workspaceId: workspace.id });
                        if (!results || results.length === 0) {
                            return {
                                chunks: [],
                                message: 'No relevant content found. Try search_pages for keyword-based search.',
                            };
                        }
                        const bestPerPage = new Map();
                        for (const r of results) {
                            const existing = bestPerPage.get(r.pageId);
                            if (!existing || r.similarity > existing.similarity) {
                                bestPerPage.set(r.pageId, r);
                            }
                        }
                        const topResults = [...bestPerPage.values()]
                            .sort((a, b) => b.similarity - a.similarity)
                            .slice(0, args.limit);
                        const chunks = await Promise.all(topResults.map(async (r) => {
                            const page = await this.pageRepo.findById(r.pageId, {
                                includeTextContent: true,
                            });
                            if (!page)
                                return null;
                            const textContent = page.textContent || '';
                            const excerpt = textContent.substring(r.chunkStart, r.chunkStart + r.chunkLength);
                            const excerptText = excerpt || `[Chunk ${r.chunkIndex}]`;
                            return {
                                pageId: r.pageId,
                                title: r.title,
                                icon: page.icon || null,
                                slugId: r.slugId,
                                spaceSlug: r.spaceSlug,
                                similarity: Math.round(r.similarity * 100) / 100,
                                excerpt: (0, untrusted_content_1.fenceUntrustedContent)({
                                    source: 'search_result',
                                    attributes: { id: r.pageId, title: r.title },
                                    body: excerptText,
                                }),
                            };
                        }));
                        return { chunks: chunks.filter(Boolean) };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            search_pages: (0, ai_1.tool)({
                description: 'Keyword-based fallback search. Use this ONLY as a fallback after semantic_search returns no results or reports that semantic search is not configured, OR when the user is looking for a page by its exact title/name/identifier. Prefer semantic_search for any concept, topic, or question-based query.',
                inputSchema: v4_1.z.object({
                    query: v4_1.z.string().describe('Search query text'),
                    limit: v4_1.z
                        .number()
                        .int()
                        .min(1)
                        .max(25)
                        .optional()
                        .default(10)
                        .describe('Maximum number of results'),
                }),
                execute: async (args) => {
                    try {
                        const searchParams = {
                            query: args.query,
                            spaceId: undefined,
                            limit: args.limit,
                            offset: 0,
                        };
                        let results;
                        if (this.environmentService.getSearchDriver() === 'typesense') {
                            results = await this.searchTypesense(searchParams, {
                                userId: user.id,
                                workspaceId: workspace.id,
                            });
                        }
                        else {
                            results = await this.searchService.searchPage(searchParams, {
                                userId: user.id,
                                workspaceId: workspace.id,
                            });
                        }
                        const pages = (results.items || []).map((p) => ({
                            id: p.id,
                            title: p.title,
                            icon: p.icon || null,
                            slugId: p.slugId,
                            spaceSlug: p.space?.slug || null,
                            highlight: p.highlight
                                ? (0, untrusted_content_1.fenceUntrustedContent)({
                                    source: 'search_result',
                                    attributes: { id: p.id, title: p.title },
                                    body: p.highlight,
                                })
                                : p.highlight,
                        }));
                        return { pages };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            list_recent_pages: (0, ai_1.tool)({
                description: 'List recent pages sorted by last updated across all accessible spaces.',
                inputSchema: v4_1.z.object({
                    limit: v4_1.z
                        .number()
                        .int()
                        .min(1)
                        .max(25)
                        .optional()
                        .default(10)
                        .describe('Maximum number of pages to return'),
                }),
                execute: async (args) => {
                    try {
                        const pagination = Object.assign(new pagination_options_1.PaginationOptions(), {
                            limit: args.limit,
                        });
                        const result = await this.pageRepo.getRecentPages(user.id, pagination);
                        let items = result.items || [];
                        if (items.length > 0) {
                            const pageIds = items.map((p) => p.id);
                            const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                                pageIds,
                                userId: user.id,
                            });
                            const accessibleSet = new Set(accessibleIds);
                            items = items.filter((p) => accessibleSet.has(p.id));
                        }
                        const pages = items.map((p) => ({
                            id: p.id,
                            title: p.title,
                            icon: p.icon || null,
                            slugId: p.slugId,
                            spaceSlug: p.space?.slug || null,
                            createdAt: p.createdAt,
                            updatedAt: p.updatedAt,
                        }));
                        return { pages };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            get_page: (0, ai_1.tool)({
                description: 'Get a page by ID including its content. Returns the page in markdown format. For large pages, returns a table of contents with the most relevant sections.',
                inputSchema: v4_1.z.object({
                    pageId: v4_1.z.string().describe('Page ID (UUID or slug)'),
                }),
                execute: async (args) => {
                    try {
                        const page = await this.pageRepo.findById(args.pageId, {
                            includeContent: true,
                            includeCreator: true,
                            includeSpace: true,
                        });
                        if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
                            return { error: 'Page not found' };
                        }
                        try {
                            await this.pageAccessService.validateCanView(page, user);
                        }
                        catch (e) {
                            if (e instanceof common_2.ForbiddenException) {
                                return {
                                    error: 'You do not have permission to view this page',
                                };
                            }
                            throw e;
                        }
                        const meta = {
                            id: page.id,
                            title: page.title,
                            icon: page.icon || null,
                            slugId: page.slugId,
                            spaceSlug: page.space?.slug || null,
                            creator: page.creator?.name || null,
                            createdAt: page.createdAt,
                            updatedAt: page.updatedAt,
                        };
                        if (!page.content) {
                            return { ...meta, content: '' };
                        }
                        const LARGE_PAGE_THRESHOLD = 4000;
                        const markdown = (0, collaboration_util_1.jsonToMarkdown)(page.content);
                        const tokens = markdown ? (0, token_counter_1.countTokens)(markdown) : 0;
                        if (tokens <= LARGE_PAGE_THRESHOLD) {
                            return {
                                ...meta,
                                content: (0, untrusted_content_1.fenceUntrustedContent)({
                                    source: 'page',
                                    attributes: {
                                        id: page.id,
                                        title: page.title,
                                        slugId: page.slugId,
                                    },
                                    body: markdown,
                                }),
                            };
                        }
                        let toc = (0, page_content_extractor_1.extractTableOfContents)(page.content);
                        if (toc.length === 0) {
                            toc = await (0, page_content_extractor_1.buildPositionalChunks)(page.content);
                        }
                        let seeded = [];
                        if (userMessage) {
                            try {
                                seeded = await (0, page_content_extractor_1.seedRelevantSections)(page.content, toc, userMessage);
                            }
                            catch {
                            }
                        }
                        const tocText = (0, page_content_extractor_1.formatTocForLlm)(page.title || 'Untitled', page.id, toc, seeded);
                        pageJsonCache?.set(page.id, page.content);
                        return {
                            ...meta,
                            tableOfContents: (0, untrusted_content_1.fenceUntrustedContent)({
                                source: 'page',
                                attributes: {
                                    id: page.id,
                                    title: page.title,
                                    slugId: page.slugId,
                                },
                                body: tocText,
                            }),
                            note: 'This page is large. The most relevant sections are shown above. Use read_page_sections to read other sections by ID, or search_in_page to find content by keywords.',
                        };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            create_page: (0, ai_1.tool)({
                description: 'Create a new page in a space. You MUST call list_spaces first to get a valid spaceId. Content should be in markdown format. IMPORTANT: Do NOT include parentPageId unless the user explicitly asked to nest this page under another page — omit the field entirely when not needed.',
                inputSchema: v4_1.z.object({
                    title: v4_1.z.string().describe('Page title'),
                    spaceId: v4_1.z
                        .uuid()
                        .describe('Space ID from list_spaces. MUST be a real ID returned by list_spaces.'),
                    content: v4_1.z.string().optional().describe('Page content in markdown'),
                    parentPageId: v4_1.z
                        .uuid()
                        .optional()
                        .describe('OMIT this field unless the user explicitly asks to nest the page under a specific parent. If provided, it MUST be a real PAGE ID from search_pages or get_page — NOT a space ID. Never use the spaceId value here.'),
                }),
                execute: async (args) => {
                    try {
                        if (args.parentPageId &&
                            ((0, fabricated_id_1.isFabricatedId)(args.parentPageId) ||
                                args.parentPageId === args.spaceId)) {
                            args.parentPageId = undefined;
                        }
                        if (args.parentPageId) {
                            const parentPage = await this.pageRepo.findById(args.parentPageId);
                            if (!parentPage ||
                                parentPage.deletedAt ||
                                parentPage.spaceId !== args.spaceId) {
                                args.parentPageId = undefined;
                            }
                            else {
                                try {
                                    await this.pageAccessService.validateCanEdit(parentPage, user);
                                }
                                catch (e) {
                                    if (e instanceof common_2.ForbiddenException) {
                                        args.parentPageId = undefined;
                                    }
                                    else {
                                        throw e;
                                    }
                                }
                            }
                        }
                        if (!args.parentPageId) {
                            const ability = await this.spaceAbility.createForUser(user, args.spaceId);
                            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Create, space_ability_type_1.SpaceCaslSubject.Page)) {
                                return {
                                    error: 'You do not have permission to create pages in this space',
                                };
                            }
                        }
                        const page = await this.pageService.create(user.id, workspace.id, {
                            title: args.title,
                            spaceId: args.spaceId,
                            content: args.content,
                            parentPageId: args.parentPageId,
                            format: 'markdown',
                        });
                        const space = await this.spaceRepo.findById(page.spaceId, workspace.id);
                        return {
                            id: page.id,
                            title: page.title,
                            icon: page.icon || null,
                            slugId: page.slugId,
                            spaceId: page.spaceId,
                            spaceSlug: space?.slug || null,
                        };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            update_page: (0, ai_1.tool)({
                description: 'Update a page title and/or content. Content should be in markdown format.',
                inputSchema: v4_1.z.object({
                    pageId: v4_1.z.uuid().describe('Page ID to update'),
                    title: v4_1.z.string().optional().describe('New page title'),
                    content: v4_1.z
                        .string()
                        .optional()
                        .describe('New page content in markdown'),
                    operation: v4_1.z
                        .enum(['replace', 'append', 'prepend'])
                        .optional()
                        .default('append')
                        .describe('How to apply content: append to end (default), prepend to beginning, or replace entirely'),
                }),
                execute: async (args) => {
                    try {
                        const page = await this.pageRepo.findById(args.pageId, {
                            includeSpace: true,
                        });
                        if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
                            return { error: 'Page not found' };
                        }
                        try {
                            await this.pageAccessService.validateCanEdit(page, user);
                        }
                        catch (e) {
                            if (e instanceof common_2.ForbiddenException) {
                                return {
                                    error: 'You do not have permission to edit this page',
                                };
                            }
                            throw e;
                        }
                        const updatedPage = await this.pageService.update(page, {
                            pageId: args.pageId,
                            title: args.title,
                            content: args.content,
                            operation: args.content ? args.operation : undefined,
                            format: 'markdown',
                        }, user);
                        return {
                            id: updatedPage.id,
                            title: updatedPage.title,
                            icon: page.icon || null,
                            slugId: updatedPage.slugId,
                            spaceSlug: page.space?.slug || null,
                        };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            read_page_sections: (0, ai_1.tool)({
                description: 'Read specific sections of a large page by their section IDs. Use this after seeing a page table of contents to fetch the sections relevant to the user question.',
                inputSchema: v4_1.z.object({
                    pageId: v4_1.z.string().describe('Page ID'),
                    sectionIds: v4_1.z
                        .array(v4_1.z.string())
                        .max(5)
                        .describe('Section IDs from the table of contents'),
                }),
                execute: async (args) => {
                    try {
                        let json = pageJsonCache?.get(args.pageId);
                        if (!json) {
                            const page = await this.pageRepo.findById(args.pageId, {
                                includeContent: true,
                            });
                            if (!page ||
                                page.workspaceId !== workspace.id ||
                                page.deletedAt) {
                                return { error: 'Page not found' };
                            }
                            try {
                                await this.pageAccessService.validateCanView(page, user);
                            }
                            catch (e) {
                                if (e instanceof common_2.ForbiddenException) {
                                    return {
                                        error: 'You do not have permission to view this page',
                                    };
                                }
                                throw e;
                            }
                            json = page.content;
                        }
                        if (!json) {
                            return { error: 'Page has no content' };
                        }
                        const sections = await (0, page_content_extractor_1.extractSections)(json, args.sectionIds);
                        return {
                            sections: sections.map((s) => ({
                                ...s,
                                content: (0, untrusted_content_1.fenceUntrustedContent)({
                                    source: 'page',
                                    attributes: {
                                        id: args.pageId,
                                        sectionId: s.id,
                                        title: s.title,
                                    },
                                    body: s.content,
                                }),
                            })),
                        };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
            search_in_page: (0, ai_1.tool)({
                description: 'Search for specific content within a large page using keywords. Returns matching sections with snippets. Use this when the table of contents headings are too vague to identify the right section.',
                inputSchema: v4_1.z.object({
                    pageId: v4_1.z.string().describe('Page ID'),
                    query: v4_1.z.string().describe('Keywords or phrase to search for'),
                }),
                execute: async (args) => {
                    try {
                        let json = pageJsonCache?.get(args.pageId);
                        if (!json) {
                            const page = await this.pageRepo.findById(args.pageId, {
                                includeContent: true,
                            });
                            if (!page ||
                                page.workspaceId !== workspace.id ||
                                page.deletedAt) {
                                return { error: 'Page not found' };
                            }
                            try {
                                await this.pageAccessService.validateCanView(page, user);
                            }
                            catch (e) {
                                if (e instanceof common_2.ForbiddenException) {
                                    return {
                                        error: 'You do not have permission to view this page',
                                    };
                                }
                                throw e;
                            }
                            json = page.content;
                        }
                        if (!json) {
                            return { error: 'Page has no content' };
                        }
                        const matches = await (0, page_content_extractor_1.searchInPageContent)(json, args.query);
                        return {
                            matches: matches.map((m) => ({
                                ...m,
                                snippet: (0, untrusted_content_1.fenceUntrustedContent)({
                                    source: 'page',
                                    attributes: {
                                        id: args.pageId,
                                        sectionId: m.sectionId,
                                    },
                                    body: m.snippet,
                                }),
                            })),
                        };
                    }
                    catch (error) {
                        return { error: error.message };
                    }
                },
            }),
        };
    }
    async searchTypesense(searchParams, opts) {
        return this.pageSearchService.searchPage(searchParams, opts);
    }
};
exports.AiChatToolsService = AiChatToolsService;
exports.AiChatToolsService = AiChatToolsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [page_repo_1.PageRepo,
        space_repo_1.SpaceRepo,
        space_member_service_1.SpaceMemberService,
        page_service_1.PageService,
        page_access_service_1.PageAccessService,
        search_service_1.SearchService,
        space_ability_factory_1.default,
        environment_service_1.EnvironmentService,
        page_search_service_1.PageSearchService,
        ai_search_service_1.AiSearchService,
        page_permission_repo_1.PagePermissionRepo])
], AiChatToolsService);
//# sourceMappingURL=ai-chat-tools.service.js.map