"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPageTools = registerPageTools;
const v4_1 = require("zod/v4");
const space_ability_type_1 = require("../../../core/casl/interfaces/space-ability.type");
const common_1 = require("@nestjs/common");
const collaboration_util_1 = require("../../../collaboration/collaboration.util");
const types_1 = require("./types");
function registerPageTools(ctx, deps) {
    registerSearchPages(ctx, deps);
    registerGetPage(ctx, deps);
    registerCreatePage(ctx, deps);
    registerUpdatePage(ctx, deps);
    registerListPages(ctx, deps);
    registerListChildPages(ctx, deps);
    registerDuplicatePage(ctx, deps);
    registerCopyPageToSpace(ctx, deps);
    registerMovePage(ctx, deps);
    registerMovePageToSpace(ctx, deps);
    registerGetBase(ctx, deps);
    registerListBaseRows(ctx, deps);
}

const postgres = require("postgres");

let pgPoolInstance = null;
function getPgPool() {
    if (!pgPoolInstance) {
        pgPoolInstance = postgres(process.env.DATABASE_URL, {
            max: 5,
            idle_timeout: 30,
            connect_timeout: 10,
        });
    }
    return pgPoolInstance;
}

function resolveCellValue(prop, rawVal, userMap) {
    if (rawVal === null || rawVal === undefined) return "";
    if (prop.type === "select" || prop.type === "status") {
        const choices = prop.type_options?.choices || [];
        const choice = choices.find(c => c.id === rawVal);
        return choice ? choice.name : String(rawVal);
    }
    if (prop.type === "multi_select") {
        let arr = Array.isArray(rawVal) ? rawVal : [];
        if (typeof rawVal === "string" && rawVal.startsWith("[")) {
            try { arr = JSON.parse(rawVal); } catch {}
        }
        if (Array.isArray(arr)) {
            const choices = prop.type_options?.choices || [];
            return arr.map(id => {
                const c = choices.find(ch => ch.id === id);
                return c ? c.name : (userMap.get(id) || id);
            }).join(", ");
        }
    }
    if (prop.type === "user" || prop.type === "person") {
        let arr = Array.isArray(rawVal) ? rawVal : null;
        if (typeof rawVal === "string" && rawVal.startsWith("[")) {
            try { arr = JSON.parse(rawVal); } catch {}
        }
        if (Array.isArray(arr)) {
            return arr.map(id => (userMap && userMap.get(id)) || id).join(", ");
        }
        return (userMap && userMap.get(rawVal)) || String(rawVal);
    }
    if (prop.type === "date" && typeof rawVal === "string") {
        return rawVal.split("T")[0];
    }
    if (typeof rawVal === "string") {
        if (userMap && userMap.has(rawVal)) return userMap.get(rawVal);
        if (rawVal.startsWith("[")) {
            try {
                const arr = JSON.parse(rawVal);
                if (Array.isArray(arr)) {
                    return arr.map(id => (userMap && userMap.get(id)) || id).join(", ");
                }
            } catch {}
        }
        return rawVal;
    }
    if (typeof rawVal === "object") {
        return JSON.stringify(rawVal);
    }
    return String(rawVal);
}

async function formatBasePage(page, format, workspaceId) {
    try {
        const sql = getPgPool();
        const pageId = page.id;

        const properties = await sql`
            SELECT id, name, type, type_options, position, is_primary 
            FROM base_properties 
            WHERE page_id = ${pageId} AND deleted_at IS NULL 
            ORDER BY position ASC
        `;

        const rows = await sql`
            SELECT id, cells, position, creator_id, updated_at 
            FROM base_rows 
            WHERE page_id = ${pageId} AND deleted_at IS NULL 
            ORDER BY position ASC
        `;

        const views = await sql`
            SELECT id, name, type, config, position 
            FROM base_views 
            WHERE page_id = ${pageId} 
            ORDER BY position ASC
        `;

        const users = await sql`SELECT id, name, email FROM users WHERE workspace_id = ${workspaceId}`;
        const userMap = new Map(users.map(u => [u.id, u.name || u.email]));
        const propMap = new Map(properties.map(p => [p.id, p]));

        // 1. Table Markdown
        let tableMd = "";
        if (properties.length > 0) {
            tableMd += "| " + properties.map(p => p.name.replace(/\|/g, "-")).join(" | ") + " |\n";
            tableMd += "| " + properties.map(() => "---").join(" | ") + " |\n";
            for (const row of rows) {
                const line = properties.map(p => {
                    const val = resolveCellValue(p, row.cells[p.id], userMap);
                    return String(val).replace(/\|/g, "/").replace(/\n/g, " ");
                }).join(" | ");
                tableMd += "| " + line + " |\n";
            }
        }

        // 2. Kanban Markdown
        let kanbanMd = "";
        const kanbanView = views.find(v => v.type === "kanban");
        if (kanbanView) {
            const groupPropId = kanbanView.config?.groupByPropertyId;
            const groupProp = propMap.get(groupPropId);
            if (groupProp && (groupProp.type === "status" || groupProp.type === "select")) {
                const choices = groupProp.type_options?.choices || [];
                const primaryProp = properties.find(p => p.is_primary) || properties[0];
                const otherProps = properties.filter(p => p.id !== primaryProp?.id && p.id !== groupPropId);

                kanbanMd += "\n## 📋 Kanban Board: " + (page.title || "Untitled") + "\n";
                for (const choice of choices) {
                    const choiceRows = rows.filter(r => r.cells[groupPropId] === choice.id);
                    kanbanMd += "\n### 🔹 " + choice.name + " (" + choiceRows.length + ")\n";
                    if (choiceRows.length === 0) {
                        kanbanMd += "*(Trống)*\n";
                    } else {
                        for (const r of choiceRows) {
                            const titleVal = primaryProp ? resolveCellValue(primaryProp, r.cells[primaryProp.id], userMap) : "";
                            kanbanMd += "- **" + (titleVal || "(Không có tiêu đề)") + "**\n";
                            for (const op of otherProps) {
                                const opVal = resolveCellValue(op, r.cells[op.id], userMap);
                                if (opVal) {
                                    kanbanMd += "  - " + op.name + ": " + opVal + "\n";
                                }
                            }
                        }
                    }
                }
            }
        }

        let fullMarkdown = "# " + (page.title || "Untitled") + "\n\n";
        fullMarkdown += "## 📊 Dữ liệu bảng (Table View)\n\n" + tableMd;
        if (kanbanMd) {
            fullMarkdown += "\n" + kanbanMd;
        }

        const baseDetails = {
            views: views.map(v => ({ id: v.id, name: v.name, type: v.type, config: v.config })),
            properties: properties.map(p => ({ id: p.id, name: p.name, type: p.type, options: p.type_options, isPrimary: p.is_primary })),
            rows: rows.map(r => {
                const rowValues = {};
                for (const p of properties) {
                    rowValues[p.name] = resolveCellValue(p, r.cells[p.id], userMap);
                }
                return {
                    id: r.id,
                    position: r.position,
                    values: rowValues,
                    rawCells: r.cells,
                };
            }),
            stats: {
                totalRows: rows.length,
                totalProperties: properties.length,
                totalViews: views.length
            }
        };

        if (format === "json") {
            return {
                ...page,
                content: fullMarkdown,
                base: baseDetails
            };
        }
        if (format === "html") {
            return {
                ...page,
                content: "<div><pre>" + fullMarkdown + "</pre></div>",
                base: baseDetails
            };
        }
        return {
            ...page,
            content: fullMarkdown,
            base: baseDetails
        };
    } catch (err) {
        console.error("Failed to format base page:", err);
        return {
            ...page,
            content: page.textContent || page.content || ""
        };
    }
}

async function formatPageContentWithEmbeds(page, format, workspaceId) {
    let result = formatPageContent(page, format);
    if (!result || !result.content || typeof result.content !== "string") {
        return result;
    }
    // Check if original content had base-embed
    const contentStr = JSON.stringify(page.content || {});
    if (contentStr.includes('"base"') || contentStr.includes('base-embed')) {
        try {
            const sql = getPgPool();
            const matches = contentStr.match(/"pageId":"([0-9a-fA-F-]{36})"/g) || [];
            const pageIds = [...new Set(matches.map(m => m.split('"')[3]))];
            for (const bPageId of pageIds) {
                const [bPage] = await sql`SELECT id, title, is_base FROM pages WHERE id = ${bPageId}`;
                if (bPage && bPage.is_base) {
                    const formatted = await formatBasePage(bPage, 'markdown', workspaceId);
                    result.content += "\n\n---\n" + formatted.content;
                }
            }
        } catch (e) {
            console.error("Failed to append embedded base data:", e);
        }
    }
    return result;
}

async function getBaseRowsList(pageId, workspaceId, limit, offset) {
    const sql = getPgPool();
    const properties = await sql`
        SELECT id, name, type, type_options, position, is_primary 
        FROM base_properties 
        WHERE page_id = ${pageId} AND deleted_at IS NULL 
        ORDER BY position ASC
    `;
    const users = await sql`SELECT id, name, email FROM users WHERE workspace_id = ${workspaceId}`;
    const userMap = new Map(users.map(u => [u.id, u.name || u.email]));
    const [countRes] = await sql`SELECT count(*) as total FROM base_rows WHERE page_id = ${pageId} AND deleted_at IS NULL`;
    const total = parseInt(countRes?.total || '0', 10);

    const rows = await sql`
        SELECT id, cells, position, creator_id, created_at, updated_at 
        FROM base_rows 
        WHERE page_id = ${pageId} AND deleted_at IS NULL 
        ORDER BY position ASC 
        LIMIT ${limit} OFFSET ${offset}
    `;

    const items = rows.map(r => {
        const values = {};
        for (const p of properties) {
            values[p.name] = resolveCellValue(p, r.cells[p.id], userMap);
        }
        return {
            id: r.id,
            position: r.position,
            values,
            rawCells: r.cells,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    });

    return {
        total,
        limit,
        offset,
        items,
    };
}

function formatPageContent(page, format) {
    if (format === 'json' || !page.content)
        return page;
    const contentOutput = format === 'markdown'
        ? (0, collaboration_util_1.jsonToMarkdown)(page.content)
        : (0, collaboration_util_1.jsonToHtml)(page.content);
    return { ...page, content: contentOutput };
}
function withPageUrl(page, baseUrl, spaceSlug) {
    const slug = spaceSlug ?? page?.space?.slug;
    if (!slug || !page?.slugId)
        return page;
    return { ...page, url: `${baseUrl}/s/${slug}/p/${page.slugId}` };
}
function withPageUrls(result, baseUrl, spaceSlug) {
    return {
        ...result,
        items: (result?.items ?? []).map((item) => withPageUrl(item, baseUrl, spaceSlug)),
    };
}
function registerSearchPages({ server, user, workspace }, deps) {
    server.registerTool('search_pages', {
        title: 'Search Pages',
        description: 'Full-text search across all pages the user has access to. Returns matching pages with highlighted snippets and a url to open each page.',
        inputSchema: v4_1.z.object({
            query: v4_1.z.string().describe('Search query text'),
            spaceId: v4_1.z
                .uuid()
                .optional()
                .describe('Filter results to a specific space'),
            limit: v4_1.z
                .number()
                .int()
                .min(1)
                .max(25)
                .optional()
                .default(10)
                .describe('Maximum number of results (1-25)'),
            offset: v4_1.z
                .number()
                .int()
                .min(0)
                .optional()
                .default(0)
                .describe('Offset for pagination'),
        }),
    }, async (args) => {
        try {
            if (args.spaceId) {
                const ability = await deps.spaceAbility.createForUser(user, args.spaceId);
                if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
                    return (0, types_1.mcpError)('You do not have permission to search in this space');
                }
            }
            const searchParams = {
                query: args.query,
                spaceId: args.spaceId,
                limit: args.limit,
                offset: args.offset,
            };
            let results;
            if (deps.environmentService.getSearchDriver() === 'typesense') {
                results = await searchTypesense(deps, searchParams, {
                    userId: user.id,
                    workspaceId: workspace.id,
                });
            }
            else {
                results = await deps.searchService.searchPage(searchParams, {
                    userId: user.id,
                    workspaceId: workspace.id,
                });
            }
            return (0, types_1.mcpResult)(withPageUrls(results, deps.domainService.getUrl(workspace.hostname)));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerGetPage({ server, user, workspace }, deps) {
    server.registerTool('get_page', {
        title: 'Get Page',
        description: 'Get a page by ID, including its content. Returns page metadata, a url to open the page, and content in the requested format.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().describe('Page ID (UUID or slug)'),
            format: v4_1.z
                .enum(['markdown', 'html', 'json'])
                .optional()
                .default('markdown')
                .describe('Content format (default: markdown)'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId, {
                includeSpace: true,
                includeContent: true,
                includeTextContent: true,
                includeCreator: true,
                includeLastUpdatedBy: true,
            });
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanView(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to view this page');
                }
                throw e;
            }
            let formattedPage;
            if (page.isBase) {
                formattedPage = await formatBasePage(page, args.format, workspace.id);
            } else {
                formattedPage = await formatPageContentWithEmbeds(page, args.format, workspace.id);
            }
            return (0, types_1.mcpResult)(withPageUrl(formattedPage, deps.domainService.getUrl(workspace.hostname)));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerCreatePage({ server, user, workspace }, deps) {
    server.registerTool('create_page', {
        title: 'Create Page',
        description: 'Create a new page in a space. Content can be provided in markdown, HTML, or JSON format.',
        inputSchema: v4_1.z.object({
            title: v4_1.z.string().optional().describe('Page title'),
            spaceId: v4_1.z
                .string()
                .uuid()
                .describe('Space ID where the page will be created'),
            content: v4_1.z.string().optional().describe('Page content'),
            parentPageId: v4_1.z
                .string()
                .uuid()
                .optional()
                .describe('Parent page ID for nested pages'),
            format: v4_1.z
                .enum(['markdown', 'html', 'json'])
                .optional()
                .default('markdown')
                .describe('Content format (default: markdown)'),
        }),
    }, async (args) => {
        try {
            if (args.parentPageId) {
                const parentPage = await deps.pageRepo.findById(args.parentPageId);
                if (!(0, types_1.validatePageInWorkspace)(parentPage, workspace.id) ||
                    parentPage.spaceId !== args.spaceId) {
                    return (0, types_1.mcpError)('Parent page not found');
                }
                try {
                    await deps.pageAccessService.validateCanEdit(parentPage, user);
                }
                catch (e) {
                    if (e instanceof common_1.ForbiddenException) {
                        return (0, types_1.mcpError)('You do not have permission to create pages under this parent');
                    }
                    throw e;
                }
            }
            else {
                const ability = await deps.spaceAbility.createForUser(user, args.spaceId);
                if (ability.cannot(space_ability_type_1.SpaceCaslAction.Create, space_ability_type_1.SpaceCaslSubject.Page)) {
                    return (0, types_1.mcpError)('You do not have permission to create pages in this space');
                }
            }
            const page = await deps.pageService.create(user.id, workspace.id, {
                title: args.title,
                spaceId: args.spaceId,
                content: args.content,
                parentPageId: args.parentPageId,
                format: args.format,
            });
            const space = await deps.spaceService.getSpaceInfo(args.spaceId, workspace.id);
            return (0, types_1.mcpResult)(withPageUrl(formatPageContent(page, args.format), deps.domainService.getUrl(workspace.hostname), space.slug));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerUpdatePage({ server, user, workspace }, deps) {
    server.registerTool('update_page', {
        title: 'Update Page',
        description: 'Update a page title and/or content. Content can be provided in markdown, HTML, or JSON format. Use the operation parameter to control how content is applied: append (default), prepend, or replace.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().uuid().describe('Page ID to update'),
            title: v4_1.z.string().optional().describe('New page title'),
            content: v4_1.z.string().optional().describe('New page content'),
            operation: v4_1.z
                .enum(['replace', 'append', 'prepend'])
                .optional()
                .default('append')
                .describe('How to apply content: append to end (default), prepend to beginning, or replace entirely. Only used when content is provided.'),
            format: v4_1.z
                .enum(['markdown', 'html', 'json'])
                .optional()
                .default('markdown')
                .describe('Content format (default: markdown)'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId);
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanEdit(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to edit this page');
                }
                throw e;
            }
            const updatedPage = await deps.pageService.update(page, {
                pageId: args.pageId,
                title: args.title,
                content: args.content,
                operation: args.content ? args.operation : undefined,
                format: args.format,
            }, user);
            return (0, types_1.mcpResult)(formatPageContent(updatedPage, args.format));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerListPages({ server, user, workspace }, deps) {
    server.registerTool('list_pages', {
        title: 'List Pages',
        description: 'List pages ordered by recently updated. Optionally filter by spaceId. Returns a paginated flat list of all pages (not just root pages). Supports cursor-based pagination.',
        inputSchema: v4_1.z.object({
            spaceId: v4_1.z
                .string()
                .uuid()
                .optional()
                .describe('Filter to a specific space'),
            cursor: v4_1.z.string().optional().describe('Pagination cursor'),
            limit: v4_1.z
                .number()
                .int()
                .min(1)
                .max(100)
                .optional()
                .default(50)
                .describe('Number of pages per page (default: 50)'),
        }),
    }, async (args) => {
        try {
            const baseUrl = deps.domainService.getUrl(workspace.hostname);
            if (args.spaceId) {
                const ability = await deps.spaceAbility.createForUser(user, args.spaceId);
                if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
                    return (0, types_1.mcpError)('You do not have permission to list pages in this space');
                }
                const result = await deps.pageService.getRecentSpacePages(args.spaceId, user.id, {
                    cursor: args.cursor,
                    limit: args.limit,
                });
                return (0, types_1.mcpResult)(withPageUrls(result, baseUrl));
            }
            const result = await deps.pageService.getRecentPages(user.id, {
                cursor: args.cursor,
                limit: args.limit,
            });
            return (0, types_1.mcpResult)(withPageUrls(result, baseUrl));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerListChildPages({ server, user, workspace }, deps) {
    server.registerTool('list_child_pages', {
        title: 'List Child Pages',
        description: 'List child pages in the page tree. Pass spaceId to list root-level pages, or pageId to list children of a specific page. Supports cursor-based pagination.',
        inputSchema: v4_1.z.object({
            spaceId: v4_1.z
                .string()
                .uuid()
                .optional()
                .describe('Space ID to list root pages from'),
            pageId: v4_1.z
                .string()
                .uuid()
                .optional()
                .describe('Parent page ID to list children of'),
            cursor: v4_1.z.string().optional().describe('Pagination cursor'),
            limit: v4_1.z
                .number()
                .int()
                .min(1)
                .max(100)
                .optional()
                .default(50)
                .describe('Number of pages per page (default: 50)'),
        }),
    }, async (args) => {
        try {
            if (!args.spaceId && !args.pageId) {
                return (0, types_1.mcpError)('Either spaceId or pageId must be provided');
            }
            let spaceId = args.spaceId;
            if (args.pageId) {
                const page = await deps.pageRepo.findById(args.pageId);
                if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                    return (0, types_1.mcpError)('Page not found');
                }
                spaceId = page.spaceId;
            }
            const ability = await deps.spaceAbility.createForUser(user, spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
                return (0, types_1.mcpError)('You do not have permission to list pages in this space');
            }
            const spaceCanEdit = ability.can(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page);
            const [result, space] = await Promise.all([
                deps.pageService.getSidebarPages(spaceId, { cursor: args.cursor, limit: args.limit }, args.pageId, user.id, spaceCanEdit),
                deps.spaceService.getSpaceInfo(spaceId, workspace.id),
            ]);
            return (0, types_1.mcpResult)(withPageUrls(result, deps.domainService.getUrl(workspace.hostname), space.slug));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerDuplicatePage({ server, user, workspace }, deps) {
    server.registerTool('duplicate_page', {
        title: 'Duplicate Page',
        description: 'Duplicate a page. Optionally specify a target space for cross-space duplication.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().uuid().describe('Page ID to duplicate'),
            spaceId: v4_1.z
                .string()
                .uuid()
                .optional()
                .describe('Target space ID for cross-space duplication'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId);
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanView(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to view this page');
                }
                throw e;
            }
            if (args.spaceId) {
                const abilities = await Promise.all([
                    deps.spaceAbility.createForUser(user, page.spaceId),
                    deps.spaceAbility.createForUser(user, args.spaceId),
                ]);
                if (abilities.some((ability) => ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page))) {
                    return (0, types_1.mcpError)('You do not have permission to duplicate to this space');
                }
                const duplicated = await deps.pageService.duplicatePage(page, args.spaceId, user);
                return (0, types_1.mcpResult)(duplicated);
            }
            const ability = await deps.spaceAbility.createForUser(user, page.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
                return (0, types_1.mcpError)('You do not have permission to duplicate this page');
            }
            const duplicated = await deps.pageService.duplicatePage(page, undefined, user);
            return (0, types_1.mcpResult)(duplicated);
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerCopyPageToSpace({ server, user, workspace }, deps) {
    server.registerTool('copy_page_to_space', {
        title: 'Copy Page to Space',
        description: 'Copy a page and its children to a different space. The original page remains in its current space.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().uuid().describe('Page ID to copy'),
            spaceId: v4_1.z
                .string()
                .uuid()
                .describe('Target space ID to copy the page to'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId);
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanView(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to view this page');
                }
                throw e;
            }
            const abilities = await Promise.all([
                deps.spaceAbility.createForUser(user, page.spaceId),
                deps.spaceAbility.createForUser(user, args.spaceId),
            ]);
            if (abilities.some((ability) => ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page))) {
                return (0, types_1.mcpError)('You do not have permission to copy pages between these spaces');
            }
            const copied = await deps.pageService.duplicatePage(page, args.spaceId, user);
            return (0, types_1.mcpResult)(copied);
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerMovePage({ server, user, workspace }, deps) {
    server.registerTool('move_page', {
        title: 'Move Page',
        description: 'Move a page within the same space. Use parentPageId to nest it under another page, or omit to make it a root page.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().uuid().describe('Page ID to move'),
            parentPageId: v4_1.z
                .string()
                .uuid()
                .nullable()
                .optional()
                .describe('Parent page ID to nest under. Omit or null to make a root page.'),
            position: v4_1.z
                .string()
                .min(5)
                .max(12)
                .optional()
                .describe('Fractional index position string (5-12 chars). If omitted, the page is moved to the end.'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId);
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanEdit(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to move this page');
                }
                throw e;
            }
            const parentPageId = args.parentPageId ?? null;
            if (parentPageId && parentPageId !== page.parentPageId) {
                const parentPage = await deps.pageRepo.findById(parentPageId);
                if (!(0, types_1.validatePageInWorkspace)(parentPage, workspace.id) ||
                    parentPage.spaceId !== page.spaceId) {
                    return (0, types_1.mcpError)('Parent page not found in the same space');
                }
                try {
                    await deps.pageAccessService.validateCanEdit(parentPage, user);
                }
                catch (e) {
                    if (e instanceof common_1.ForbiddenException) {
                        return (0, types_1.mcpError)('You do not have permission to move pages under this parent');
                    }
                    throw e;
                }
            }
            const position = args.position ??
                (await deps.pageService.nextPagePosition(page.spaceId, parentPageId));
            await deps.pageService.movePage({ pageId: args.pageId, position, parentPageId }, page);
            return (0, types_1.mcpResult)({
                message: `Page "${page.title}" moved successfully`,
            });
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
function registerMovePageToSpace({ server, user, workspace }, deps) {
    server.registerTool('move_page_to_space', {
        title: 'Move Page to Space',
        description: 'Move a page and its children to a different space. The page becomes a root page in the target space.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().uuid().describe('Page ID to move'),
            spaceId: v4_1.z
                .string()
                .uuid()
                .describe('Target space ID to move the page to'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId);
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            if (page.spaceId === args.spaceId) {
                return (0, types_1.mcpError)('Page is already in this space');
            }
            const abilities = await Promise.all([
                deps.spaceAbility.createForUser(user, page.spaceId),
                deps.spaceAbility.createForUser(user, args.spaceId),
            ]);
            if (abilities.some((ability) => ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page))) {
                return (0, types_1.mcpError)('You do not have permission to move pages between these spaces');
            }
            try {
                await deps.pageAccessService.validateCanEdit(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to move this page');
                }
                throw e;
            }
            await deps.pageService.movePageToSpace(page, args.spaceId, user.id);
            return (0, types_1.mcpResult)({
                message: `Page "${page.title}" moved to space ${args.spaceId}`,
            });
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
async function searchTypesense(deps, searchParams, opts) {
    let TypesenseModule;
    try {
        TypesenseModule = require('../../typesense/services/page-search.service');
        const PageSearchService = deps.moduleRef.get(TypesenseModule.PageSearchService, { strict: false });
        return PageSearchService.searchPage(searchParams, opts);
    }
    catch {
    }
    return deps.searchService.searchPage(searchParams, opts);
}
//# sourceMappingURL=page.tools.js.map

function registerGetBase({ server, user, workspace }, deps) {
    server.registerTool('get_base', {
        title: 'Get Base',
        description: 'Get full details of a database/table/kanban base by page ID, including its columns/properties, views, and rows with resolved cell values.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().describe('Page ID (UUID or slug) of the database/kanban page'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId, {
                includeSpace: true,
                includeContent: true,
                includeTextContent: true,
                includeCreator: true,
                includeLastUpdatedBy: true,
            });
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanView(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to view this page');
                }
                throw e;
            }
            if (!page.isBase) {
                return (0, types_1.mcpError)('Page is not a database/table/kanban base');
            }
            const baseData = await formatBasePage(page, 'json', workspace.id);
            return (0, types_1.mcpResult)(withPageUrl(baseData, deps.domainService.getUrl(workspace.hostname)));
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}

function registerListBaseRows({ server, user, workspace }, deps) {
    server.registerTool('list_base_rows', {
        title: 'List Base Rows',
        description: 'List rows/records in a database or kanban board with resolved cell values, support filtering and pagination.',
        inputSchema: v4_1.z.object({
            pageId: v4_1.z.string().describe('Page ID (UUID or slug) of the database/kanban page'),
            limit: v4_1.z.number().int().min(1).max(100).optional().default(50).describe('Maximum number of rows to return'),
            offset: v4_1.z.number().int().min(0).optional().default(0).describe('Offset for pagination'),
        }),
    }, async (args) => {
        try {
            const page = await deps.pageRepo.findById(args.pageId, {
                includeSpace: true,
            });
            if (!(0, types_1.validatePageInWorkspace)(page, workspace.id)) {
                return (0, types_1.mcpError)('Page not found');
            }
            try {
                await deps.pageAccessService.validateCanView(page, user);
            }
            catch (e) {
                if (e instanceof common_1.ForbiddenException) {
                    return (0, types_1.mcpError)('You do not have permission to view this page');
                }
                throw e;
            }
            if (!page.isBase) {
                return (0, types_1.mcpError)('Page is not a database/table/kanban base');
            }
            const rowsResult = await getBaseRowsList(page.id, workspace.id, args.limit, args.offset);
            return (0, types_1.mcpResult)(rowsResult);
        }
        catch (error) {
            return (0, types_1.mcpError)(error.message);
        }
    });
}
