import { NextRequest } from 'next/server';

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequestPayload {
  messages: ChatMessage[];
  config: {
    apiUrl: string;
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestPayload;
    const { messages, config } = body;

    if (!config || !config.apiUrl || !config.apiKey) {
      return new Response('Missing LLM configuration', { status: 400 });
    }

    let endpoint = config.apiUrl.trim().replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
    }

    const payload = {
      model: config.model || 'gpt-3.5-turbo',
      messages,
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature ?? 0.7,
      top_p: config.topP ?? 1,
      stream: true,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`OpenAI API error: ${errorText}`, { status: response.status });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
