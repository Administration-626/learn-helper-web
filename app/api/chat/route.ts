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

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.startsWith('0.0.0.0') ||
      host === '::1' ||
      host === '[::1]' ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
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

    if (!isSafeUrl(endpoint)) {
      return new Response('Invalid or disallowed API URL', { status: 400 });
    }

    const payload = {
      model: config.model || 'gpt-3.5-turbo',
      messages,
      max_tokens: Math.max(config.maxTokens || 8192, 4096),
      temperature: config.temperature ?? 0.7,
      top_p: config.topP ?? 1,
      stream: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`LLM upstream error (${response.status}): ${errorText.slice(0, 500)}`, {
        status: response.status,
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return new Response(`Server error: ${message}`, { status: 500 });
  }
}
