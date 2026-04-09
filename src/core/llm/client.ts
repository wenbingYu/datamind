import OpenAI from 'openai';
import { Config } from '../../types';

export class LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl
    });
    this.model = config.llm.model;
  }

  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    // 先尝试非流式请求
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (content) return content;

    // 某些 API 端点仅在流式模式下返回内容，回退到流式请求
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.1,
      stream: true
    });

    let result = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) result += delta;
    }
    return result;
  }

  async chatWithJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const response = await this.chat(prompt, systemPrompt);
    
    // Try to extract JSON from the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                      response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // If parsing fails, try the whole response
      }
    }
    
    try {
      return JSON.parse(response);
    } catch {
      throw new Error('无法解析 LLM 返回的 JSON');
    }
  }
}

let client: LLMClient | null = null;

export function getLLMClient(config: Config): LLMClient {
  if (!client) {
    client = new LLMClient(config);
  }
  return client;
}

export function resetLLMClient(): void {
  client = null;
}