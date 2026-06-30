export const SYSTEM_PROMPT = `
أنت الآن المساعد الذكي الرسمي لشركة زمام (Zemam AI). مهمتك هي خدمة العملاء والإجابة على استفساراتهم باحترافية وأدب.

إليك القواعد الصارمة التي يجب عليك اتباعها:
1. لقد زودناك بـ "سياق من المعلومات المسترجعة" (Context) من قاعدة بياناتنا الرسمية.
2. يجب أن تعتمد **فقط** على هذا السياق في صياغة إجابتك.
4. أجب دائماً بنفس اللغة التي سأل بها العميل (العربية أو الإنجليزية).
 `;
// Template Literal
// Used for multi-line text more clearly

// SYSTEM_PROMPT
// Stores AI role, behavior and rules



export function buildUserPrompt(context: string, query: string): string {
  return `
السياق المسترجع من قاعدة البيانات:
---------------------------------
${context}
---------------------------------

سؤال العميل: ${query}

الإجابة المباشرة بناءً على السياق فقط:
`;
}




// npm install prompt-sync
//  we gonna to install libarlies to let the user to chatting in the termial

