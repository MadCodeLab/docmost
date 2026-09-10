import sys

orig_path = '/home/opc/docmost/server-overrides/page.service.js.orig'
with open(orig_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Target after filterAccessibleTreePages
target1 = 'const pages = await this.filterAccessibleTreePages(allPages, rootPage.id, authUser.id, rootPage.spaceId);'
repl1 = '''const pages = await this.filterAccessibleTreePages(allPages, rootPage.id, authUser.id, rootPage.spaceId);
        const pageIds = pages.map((p) => p.id);
        if (pageIds.length > 0) {
            const baseInfoList = await this.db
                .selectFrom('pages')
                .select(['id', 'isBase', 'baseSchemaVersion'])
                .where('id', 'in', pageIds)
                .execute();
            const baseInfoMap = new Map(baseInfoList.map((b) => [b.id, b]));
            for (const p of pages) {
                const info = baseInfoMap.get(p.id);
                if (info) {
                    p.isBase = info.isBase;
                    p.baseSchemaVersion = info.baseSchemaVersion;
                }
            }
        }'''

assert target1 in code, 'target1 missing'
code = code.replace(target1, repl1, 1)

# 2. Target in insertablePages return
target2 = '''                creatorId: authUser.id,
                lastUpdatedById: authUser.id,
                parentPageId: page.id === rootPage.id'''

repl2 = '''                creatorId: authUser.id,
                lastUpdatedById: authUser.id,
                isBase: Boolean(page.isBase),
                baseSchemaVersion: page.baseSchemaVersion ?? 0,
                parentPageId: page.id === rootPage.id'''

assert target2 in code, 'target2 missing'
code = code.replace(target2, repl2, 1)

# 3. Target after insertInto('pages').values(insertablePages).execute();
target3 = "await this.db.insertInto('pages').values(insertablePages).execute();"
repl3 = """await this.db.insertInto('pages').values(insertablePages).execute();
        for (const page of pages) {
            if (!page.isBase) continue;
            const newPageId = pageMap.get(page.id)?.newPageId;
            if (!newPageId) continue;
            try {
                const properties = await this.db
                    .selectFrom('baseProperties')
                    .selectAll()
                    .where('pageId', '=', page.id)
                    .where('deletedAt', 'is', null)
                    .execute();
                if (properties.length > 0) {
                    const insertableProps = properties.map((prop) => ({
                        id: prop.id,
                        pageId: newPageId,
                        name: prop.name,
                        type: prop.type,
                        position: prop.position,
                        typeOptions: prop.typeOptions,
                        pendingType: prop.pendingType,
                        pendingTypeOptions: prop.pendingTypeOptions,
                        pendingToken: prop.pendingToken,
                        isPrimary: prop.isPrimary,
                        schemaVersion: prop.schemaVersion,
                        workspaceId: page.workspaceId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }));
                    await this.db.insertInto('baseProperties').values(insertableProps).execute();
                }
                const views = await this.db
                    .selectFrom('baseViews')
                    .selectAll()
                    .where('pageId', '=', page.id)
                    .execute();
                if (views.length > 0) {
                    const insertableViews = views.map((view) => ({
                        id: (0, uuid_1.v7)(),
                        pageId: newPageId,
                        name: view.name,
                        type: view.type,
                        position: view.position,
                        config: view.config,
                        workspaceId: page.workspaceId,
                        creatorId: authUser.id,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }));
                    await this.db.insertInto('baseViews').values(insertableViews).execute();
                }
                const rows = await this.db
                    .selectFrom('baseRows')
                    .selectAll()
                    .where('pageId', '=', page.id)
                    .where('deletedAt', 'is', null)
                    .execute();
                if (rows.length > 0) {
                    const insertableRows = rows.map((row) => ({
                        id: (0, uuid_1.v7)(),
                        pageId: newPageId,
                        cells: row.cells,
                        position: row.position,
                        creatorId: authUser.id,
                        lastUpdatedById: authUser.id,
                        workspaceId: page.workspaceId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }));
                    const BATCH_SIZE = 500;
                    for (let i = 0; i < insertableRows.length; i += BATCH_SIZE) {
                        const batch = insertableRows.slice(i, i + BATCH_SIZE);
                        await this.db.insertInto('baseRows').values(batch).execute();
                    }
                }
            } catch (baseErr) {
                this.logger.error('Failed to duplicate base data for page ' + page.id, baseErr);
            }
        }"""

assert target3 in code, 'target3 missing'
code = code.replace(target3, repl3, 1)

out_path = '/home/opc/docmost/server-overrides/page.service.js'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(code)

print('Patch applied successfully!')
