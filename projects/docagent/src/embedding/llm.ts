import OpenAI from 'openai';
import { Config } from '../types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMService {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.apiKey || config.zhipuApiKey,
      baseURL: config.baseUrl || config.zhipuBaseUrl,
    });
    this.model = config.llmModel;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
    });
    
    return response.choices[0]?.message?.content || '';
  }

  async askWithContext(
    question: string,
    context: string,
    systemPrompt?: string
  ): Promise<string> {
    const defaultSystemPrompt = `你是一个文档问答助手。请根据提供的上下文回答用户问题。
如果上下文中没有相关信息，请明确说明"根据现有文档无法回答此问题"。
回答时请准确引用来源，不要编造信息。`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt || defaultSystemPrompt },
      { role: 'user', content: `上下文信息：\n${context}\n\n问题：${question}` },
    ];

    return this.chat(messages);
  }
}