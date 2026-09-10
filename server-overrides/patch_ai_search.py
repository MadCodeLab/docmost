import re

with open('/home/opc/docmost/server-overrides/ai-search.service.js', 'r') as f:
    content = f.read()

target = '''        if (!this.environmentService.getAiEmbeddingModel()?.length) {
            throw new common_1.BadRequestException('AI embedding model is not configured');
        }
        const embedding = await this.aiService.generateEmbeddings(query);'''

replacement = '''        if (!this.environmentService.getAiEmbeddingModel()?.length) {
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
            pagesQuery = pagesQuery.where((eb) =>
                eb.or([
                    eb('p.title', 'ilike', '%' + searchQuery + '%'),
                    eb('p.textContent', 'ilike', '%' + searchQuery + '%'),
                ])
            ).limit(10);
            let matchedPages = await pagesQuery.execute();
            if (matchedPages.length > 0) {
                const pageIds = [...new Set(matchedPages.map((p) => p.pageId))];
                const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                    pageIds,
                    userId: opts.userId,
                });
                const accessibleSet = new Set(accessibleIds);
                matchedPages = matchedPages.filter((p) => accessibleSet.has(p.pageId));
            }
            return matchedPages.map((p, idx) => ({
                id: 'fallback-' + p.pageId + '-' + idx,
                pageId: p.pageId,
                spaceId: p.spaceId,
                workspaceId: opts.workspaceId,
                chunkIndex: 0,
                chunkStart: 0,
                chunkLength: Math.min((p.textContent || '').length, 2000),
                metadata: {},
                title: p.title,
                slugId: p.slugId,
                spaceSlug: p.spaceSlug,
                distance: 0.1,
                similarity: 0.9,
            }));
        }
        const embedding = await this.aiService.generateEmbeddings(query);'''

if target in content:
    content = content.replace(target, replacement, 1)
    print(Replaced embedding check with fallback text search.)
else:
    print(Target block not found!)

# Thay câu trả lời mặc định khi không tìm thấy kết quả
content = content.replace(
    'yield I couldn't find any relevant pages in your workspace for that query.;',
    'yield Không tìm thấy trang hoặc tài liệu nào liên quan trong không gian làm việc của bạn cho nội dung tìm kiếm này.;'
)

with open('/home/opc/docmost/server-overrides/ai-search.service.js', 'w') as f:
    f.write(content)

print(Patch applied successfully!)
