import sys

# 1. Patch ai-chat.service.js
chat_path = '/home/opc/docmost/server-overrides/ai-chat.service.js.orig'
with open(chat_path, 'r', encoding='utf-8') as f:
    chat_code = f.read()

target_find = '''                const page = await this.pageRepo.findById(pageId, {
                    includeContent: true,
                    includeSpace: true,
                });'''

repl_find = '''                const page = await this.pageRepo.findById(pageId, {
                    includeContent: true,
                    includeSpace: true,
                    includeTextContent: true,
                });'''

assert target_find in chat_code, 'target_find missing in ai-chat.service.js'
chat_code = chat_code.replace(target_find, repl_find, 1)

target_content_check = '''                if (!page.content) {
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
                if (tokens <= SKELETON_THRESHOLD) {'''

repl_content_check = '''                const isBasePage = Boolean(page.isBase);
                const markdown = (isBasePage || !page.content)
                    ? (page.textContent || '')
                    : (0, collaboration_util_1.jsonToMarkdown)(page.content);

                if (!markdown) {
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
                const tokens = (0, token_counter_1.countTokens)(markdown);
                if (tokens <= SKELETON_THRESHOLD || isBasePage) {'''

assert target_content_check in chat_code, 'target_content_check missing in ai-chat.service.js'
chat_code = chat_code.replace(target_content_check, repl_content_check, 1)

with open('/home/opc/docmost/server-overrides/ai-chat.service.js', 'w', encoding='utf-8') as f:
    f.write(chat_code)
print('Patched ai-chat.service.js successfully!')

# 2. Patch ai-chat-tools.service.js
tools_path = '/home/opc/docmost/server-overrides/ai-chat-tools.service.js.orig'
with open(tools_path, 'r', encoding='utf-8') as f:
    tools_code = f.read()

target_tools_find = '''                        const page = await this.pageRepo.findById(args.pageId, {
                            includeContent: true,
                            includeCreator: true,
                            includeSpace: true,
                        });'''

repl_tools_find = '''                        const page = await this.pageRepo.findById(args.pageId, {
                            includeContent: true,
                            includeCreator: true,
                            includeSpace: true,
                            includeTextContent: true,
                        });'''

assert target_tools_find in tools_code, 'target_tools_find missing in ai-chat-tools.service.js'
tools_code = tools_code.replace(target_tools_find, repl_tools_find, 1)

target_tools_content = '''                        if (!page.content) {
                            return { ...meta, content: '' };
                        }
                        const LARGE_PAGE_THRESHOLD = 4000;
                        const markdown = (0, collaboration_util_1.jsonToMarkdown)(page.content);
                        const tokens = markdown ? (0, token_counter_1.countTokens)(markdown) : 0;
                        if (tokens <= LARGE_PAGE_THRESHOLD) {'''

repl_tools_content = '''                        const isBasePage = Boolean(page.isBase);
                        const markdown = (isBasePage || !page.content)
                            ? (page.textContent || '')
                            : (0, collaboration_util_1.jsonToMarkdown)(page.content);

                        if (!markdown) {
                            return { ...meta, content: '' };
                        }
                        const LARGE_PAGE_THRESHOLD = 4000;
                        const tokens = markdown ? (0, token_counter_1.countTokens)(markdown) : 0;
                        if (tokens <= LARGE_PAGE_THRESHOLD || isBasePage) {'''

assert target_tools_content in tools_code, 'target_tools_content missing in ai-chat-tools.service.js'
tools_code = tools_code.replace(target_tools_content, repl_tools_content, 1)

with open('/home/opc/docmost/server-overrides/ai-chat-tools.service.js', 'w', encoding='utf-8') as f:
    f.write(tools_code)
print('Patched ai-chat-tools.service.js successfully!')
