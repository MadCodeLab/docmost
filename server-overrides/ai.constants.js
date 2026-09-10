"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AI_CONFIG = exports.EDITOR_OUTPUT_CONTRACT = exports.AI_SYSTEM_PROMPTS = exports.MAX_VECTOR_DIMENSIONS = exports.AI_DRIVER_TOKEN = exports.AI_CONFIG_TOKEN = void 0;
exports.AI_CONFIG_TOKEN = 'AI_CONFIG_TOKEN';
exports.AI_DRIVER_TOKEN = 'AI_DRIVER_TOKEN';
exports.MAX_VECTOR_DIMENSIONS = 1536;
const FORMATTING_GUIDELINES = '\n\nFormatting guidelines:\n' +
    'The input is provided in markdown format. Output in markdown format.\n' +
    'Preserve all inline formatting (bold, italic, strikethrough) in corresponding locations in the new text.\n' +
    'Preserve headings, lists (bullet, numbered, task) and links.\n' +
    'You must not add or remove formatting that was not in the original text. \n\nYou must not ask the user for feedback.\\n' +
    'You must never start with a heading unless the source text does.';
exports.AI_SYSTEM_PROMPTS = {
    IMPROVE_WRITING: () => 'Improve the following text while maintaining its original meaning and tone. Make it clearer, more concise, and professional.' +
        FORMATTING_GUIDELINES,
    FIX_SPELLING_GRAMMAR: () => 'Fix all spelling and grammar errors in the following text. Only correct errors, do not change the style or meaning.' +
        FORMATTING_GUIDELINES,
    MAKE_SHORTER: () => 'Make the following text more concise while preserving all key information and meaning.' +
        FORMATTING_GUIDELINES,
    MAKE_LONGER: () => 'Expand the following text with more details, examples, and explanations while maintaining the original message. You must make revisions that are different from the original text. Do not editorialize or add new detail. Do not trivially repeat text to make it longer.' +
        FORMATTING_GUIDELINES,
    SIMPLIFY: () => 'Simplify the following text to make it easier to understand for a general audience. Use simpler words and shorter sentences.' +
        FORMATTING_GUIDELINES,
    SUMMARIZE: () => 'Provide a concise summary of the following text, capturing the main points and key information.',
    EXPLAIN: () => 'Explain the following text in simple terms. Break down complex concepts and make it easy to understand. Use clear, concise language.',
    CONTINUE_WRITING: () => 'You are an assistant helping a user write a document.  Output how the document continues, no more than 3 sentences. Continue writing from where the following text ends. Maintain the same style, tone, and context.',
    CHANGE_TONE: (input) => {
        return (`Change the tone of the following text to ${input.tone || 'professional'}. Maintain the original meaning.` +
            FORMATTING_GUIDELINES);
    },
    TRANSLATE: (input) => {
        return (`Translate the following text to ${input.language || 'English'}. Detect the original language automatically. Respond with the translation only, no commentary.` +
            FORMATTING_GUIDELINES);
    },
};
exports.EDITOR_OUTPUT_CONTRACT = 'You are a writing assistant embedded in a document editor, not a chatbot. ' +
    'Your response is inserted directly into the document, so return only the requested text, ready to use as-is. ' +
    'Do not greet the user, add any preamble or introduction, restate the request, or explain what you did. ' +
    'Do not add a closing remark, ask questions, or offer to continue or make further changes. ' +
    'Do not wrap the output in quotation marks or code fences unless the requested content is itself code.';
exports.DEFAULT_AI_CONFIG = {
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '65536', 10),
    temperature: 0.7,
};
//# sourceMappingURL=ai.constants.js.map