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

export async function GET() {
  const hasServerConfig = Boolean(process.env.LLM_API_KEY && process.env.LLM_API_URL);
  return Response.json({
    hasServerConfig,
    serverModel: hasServerConfig ? (process.env.LLM_MODEL || 'default') : null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestPayload;
    const { messages, config } = body;

    const apiUrl = (config?.apiUrl || process.env.LLM_API_URL || '').trim();
    const apiKey = (config?.apiKey || process.env.LLM_API_KEY || '').trim();
    const model = (config?.model || process.env.LLM_MODEL || 'gpt-4o-mini').trim();
    const maxTokens = config?.maxTokens || (process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : 8192);
    const temperature = config?.temperature ?? (process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0.7);
    const topP = config?.topP ?? (process.env.LLM_TOP_P ? parseFloat(process.env.LLM_TOP_P) : 1);

    if (!apiUrl || !apiKey) {
      return new Response('Missing LLM configuration: 请在【设置】页面配置 API Key，或在服务器配置环境变量', { status: 400 });
    }

    let endpoint = apiUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
    }

    if (!isSafeUrl(endpoint)) {
      return new Response('Invalid or disallowed API URL', { status: 400 });
    }

    const payload = {
      model,
      messages,
      max_tokens: Math.max(maxTokens, 4096),
      temperature,
      top_p: topP,
      stream: true,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    // 客户端断开连接时（用户停止/离开页面），也中止上游请求
    req.signal.addEventListener('abort', () => controller.abort(), { once: true });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response('上游 LLM 服务响应超时（90 秒），请检查 API 地址和模型是否可用，或稍后重试。', { status: 504 });
    }
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return new Response(`Server error: ${message}`, { status: 500 });
  }
}
