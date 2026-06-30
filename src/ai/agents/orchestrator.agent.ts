import  llm  from '../llm.js'
import { SYSTEM_PROMPT } from '../prompt.js'
import { getContext } from '../../rag/getContext.js'
import { CLIENT_RENEG_LIMIT } from 'tls'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AgentName =
  | 'sales'
  | 'inventory'
  | 'cashflow'
  | 'tax'
  | 'fraud'
  | 'accounting'
  | 'general'
// here we define the types of agents that can be used in the orchestrator

const agentKeywords: Record<Exclude<AgentName, 'general'>, string[]> = {
    // Record<Exclude<AgentName means that we are creating a record type where the keys are the AgentName type excluding 'general', and the values are arrays of strings. This is used to map each agent to its associated keywords.
  sales: ['sales', 'revenue', 'income', 'مبيعات', 'إيرادات', 'دخل'],
  inventory: ['inventory', 'stock', 'product', 'مخزون', 'منتج', 'المنتجات'],
  cashflow: ['cash', 'cash flow', 'liquidity', 'تدفق', 'سيولة', 'كاش'],
  tax: ['tax', 'vat', 'zakat', 'ضريبة', 'الضريبة', 'زكاة', 'القيمة المضافة'],
  fraud: ['fraud', 'suspicious', 'duplicate', 'احتيال', 'مشبوه', 'مكرر', 'تلاعب'],
  accounting: ['profit', 'loss', 'expense', 'invoice', 'debt', 'ربح', 'خسارة', 'مصروف', 'فاتورة', 'ديون', 'مستحقات'],
}

function hasAnyKeyword(message: string, keywords: string[]): boolean {
    // means if the message contains any of the keywords, return true, otherwise return false

  return keywords.some((keyword) => message.includes(keyword))

}

function selectAgent(userMessage: string): AgentName {
    // This function takes a user message as input and determines which agent should handle the message based on the presence of specific keywords.
    //  It returns the name of the selected agent or 'general' if no specific agent is matched.
  const message = userMessage.toLowerCase()

  if (hasAnyKeyword(message, agentKeywords.sales)) {
    return 'sales'
  }

  if (hasAnyKeyword(message, agentKeywords.inventory)) {
    return 'inventory'
  }

  if (hasAnyKeyword(message, agentKeywords.cashflow)) {
    return 'cashflow'
  }

  if (hasAnyKeyword(message, agentKeywords.tax)) {
    return 'tax'
  }

  if (hasAnyKeyword(message, agentKeywords.fraud)) {
    return 'fraud'
  }

  if (hasAnyKeyword(message, agentKeywords.accounting)) {
    return 'accounting'
  }

  return 'general'
}

function getAgentInstruction(agentName: AgentName): string {
  switch (agentName) {
    case 'sales':
      return 'You are the Sales Agent. Focus on sales, revenue, products sold, and sales performance.'

    case 'inventory':
      return 'You are the Inventory Agent. Focus on stock levels, low inventory, products, and reorder needs.'

    case 'cashflow':
      return 'You are the Cash Flow Agent. Focus on cash movement, liquidity, and future cash needs.'

    case 'tax':
      return 'You are the Tax Agent. Focus on VAT, tax, zakat, and tax-related summaries.'

    case 'fraud':
      return 'You are the Fraud Detection Agent. Focus on suspicious transactions, duplicate invoices, and unusual financial activity.'

    case 'accounting':
      return 'You are the Accounting Agent. Focus on profit, loss, expenses, invoices, debts, and financial records.'

    case 'general':
      return 'You are the General CFO Assistant. Give a helpful financial answer and ask for more details if needed.'
  }
}


export async function runOrchestrator(
  userMessage : string,
  oldMessages : ChatMessage[] 


){
    const selectedAgent = selectAgent(userMessage)
  const agentInstruction = getAgentInstruction(selectedAgent)

console.log('==============================')
console.log('ORCHESTRATOR CALLED')
console.log('USER MESSAGE:', userMessage)
console.log('SELECTED AGENT:', selectedAgent)
console.log('==============================')


 

  const contextText = await getContext(userMessage)


const response = await llm.chat.completions.create({
  model: process.env.LLM_MODEL!,
  max_tokens: 1000,
  messages: [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}

Selected agent: ${selectedAgent}

${agentInstruction}

استخدم المعلومات التالية للإجابة على المستخدم:
${contextText}`,
    },
    ...oldMessages,
    {
      role: 'user',
      content: userMessage,
    },
  ],
})

const aiReply = response.choices[0].message.content

return aiReply
}


