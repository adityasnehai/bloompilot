const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

type OpenAIResponsePayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export type OpenAIImageInput = {
  bytes: Uint8Array;
  mimeType: string;
};

function requireOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return key;
}

function extractJsonText(payload: OpenAIResponsePayload) {
  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .find(Boolean);

  if (!text) {
    throw new Error("OpenAI returned no text output");
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

export async function requestOpenAIJson<T>({
  prompt,
  image,
  images,
  maxOutputTokens = 900,
}: {
  prompt: string;
  image?: OpenAIImageInput;
  images?: OpenAIImageInput[];
  maxOutputTokens?: number;
}) {
  const inputContent: Array<{ type: string; text?: string; image_url?: string }> = [
    {
      type: "input_text",
      text: prompt,
    },
  ];

  const allImages = [...(images ?? []), ...(image ? [image] : [])];
  for (const img of allImages) {
    inputContent.push({
      type: "input_image",
      image_url: `data:${img.mimeType};base64,${Buffer.from(img.bytes).toString("base64")}`,
    });
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      store: false,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: "user",
          content: inputContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const raw = extractJsonText(payload);
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`OpenAI returned malformed JSON: ${err instanceof Error ? err.message : "parse failed"}`);
  }
}

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: null; tool_calls: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ChatCompletionResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ChatToolCall[];
    };
    finish_reason: string;
  }>;
};

export type ChatCompletionResult = {
  content: string | null;
  toolCalls: ChatToolCall[];
  finishReason: string;
};

export async function requestOpenAIChat({
  messages,
  tools,
  maxTokens = 2000,
}: {
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  maxTokens?: number;
}): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    messages,
    max_tokens: maxTokens,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI chat request failed: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const choice = payload.choices?.[0];
  if (!choice) {
    throw new Error("OpenAI returned no choices");
  }

  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls ?? [],
    finishReason: choice.finish_reason,
  };
}
