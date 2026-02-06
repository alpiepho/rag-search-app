/**
 * Ollama API Client
 * Provides methods to interact with local Ollama instance for embeddings and text generation
 */

interface OllamaEmbeddingRequest {
  model: string;
  input: string;
}

interface OllamaEmbeddingResponse {
  embeddings?: number[][];  // Array of embeddings (Ollama format)
  embedding?: number[];      // Single embedding (some versions)
  data?: Array<{ embedding: number[] }>;  // OpenAI format with data array
  object?: string;           // OpenAI format object type
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  temperature?: number;
  top_k?: number;
  top_p?: number;
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
  }>;
}

// Required environment variables - must be set in .env.local
const OLLAMA_URL = process.env.OLLAMA_URL;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;
const CHAT_MODEL = process.env.CHAT_MODEL;
const EMBEDDING_FORMAT = process.env.EMBEDDING_FORMAT || 'openai';  // 'openai' or 'ollama'
const REQUEST_TIMEOUT = 120000; // 2 minutes for Ollama requests

// Validate required environment variables
if (!OLLAMA_URL) {
  throw new Error(
    'OLLAMA_URL environment variable is required. ' +
    'Please set it in .env.local (e.g., OLLAMA_URL=http://10.0.0.60:11434)'
  );
}

if (!EMBEDDING_MODEL) {
  throw new Error(
    'EMBEDDING_MODEL environment variable is required. ' +
    'Please set it in .env.local (e.g., EMBEDDING_MODEL=nomic-embed-text)'
  );
}

if (!CHAT_MODEL) {
  throw new Error(
    'CHAT_MODEL environment variable is required. ' +
    'Please set it in .env.local (e.g., CHAT_MODEL=llama3.1:8b)'
  );
}

// Type-safe assertions after validation
const OLLAMA_URL_SAFE = OLLAMA_URL as string;
const EMBEDDING_MODEL_SAFE = EMBEDDING_MODEL as string;
const CHAT_MODEL_SAFE = CHAT_MODEL as string;
const EMBEDDING_FORMAT_SAFE = EMBEDDING_FORMAT as 'openai' | 'ollama';

/**
 * Generate embedding for input text using Ollama
 * @param text - Input text to embed
 * @returns Array of numbers representing the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Choose endpoint based on configured format
    const endpoint = EMBEDDING_FORMAT_SAFE === 'ollama'
      ? `${OLLAMA_URL_SAFE}/api/embed`
      : `${OLLAMA_URL_SAFE}/v1/embeddings`;

    // Build request based on format
    const requestBody = EMBEDDING_FORMAT_SAFE === 'ollama'
      ? { model: EMBEDDING_MODEL_SAFE, input: text }
      : { model: EMBEDDING_MODEL_SAFE, input: text };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama embedding request failed: ${response.statusText}`);
    }

    const data: OllamaEmbeddingResponse = await response.json();

    // Handle multiple response formats:
    // - OpenAI format: data array with embedding objects
    // - Ollama format: embeddings array of arrays (batch mode)
    // - Single embedding: single embedding array
    let embedding: number[] | undefined;

    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      embedding = data.data[0].embedding; // OpenAI format
    } else if (data.embeddings && Array.isArray(data.embeddings) && data.embeddings.length > 0) {
      embedding = data.embeddings[0]; // Ollama batch format
    } else if (data.embedding && Array.isArray(data.embedding)) {
      embedding = data.embedding; // Single embedding format
    }

    if (!embedding) {
      throw new Error('No embedding in response from Ollama');
    }

    return embedding;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate text completion using Ollama
 * @param systemPrompt - System instruction/context
 * @param userMessage - User message/question
 * @param temperature - Temperature for generation (0-2, default 0.7)
 * @returns Generated text response
 */
export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
  temperature: number = 0.7
): Promise<string> {
  try {
    // Format prompt in Ollama format with system context
    const prompt = `${systemPrompt}\n\n${userMessage}`;

    const request: OllamaGenerateRequest = {
      model: CHAT_MODEL_SAFE,
      prompt: prompt,
      stream: false,
      temperature: temperature,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${OLLAMA_URL_SAFE}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama generation request failed: ${response.statusText}`);
    }

    const data: OllamaGenerateResponse = await response.json();

    if (!data.response) {
      throw new Error('No response from Ollama');
    }

    return data.response.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate completion: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if Ollama is running and accessible
 * @returns true if Ollama is healthy, false otherwise
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_URL_SAFE}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Ollama health check failed:', error);
    return false;
  }
}

/**
 * Get list of available models in Ollama
 * @returns Array of model names
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${OLLAMA_URL_SAFE}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data: OllamaTagsResponse = await response.json();
    return data.models.map((model) => model.name);
  } catch (error) {
    console.error('Failed to get available models:', error);
    return [];
  }
}

/**
 * Validate Ollama setup on application startup
 * @throws Error if Ollama is not running or models are not available
 */
export async function validateOllamaSetup(): Promise<void> {
  console.log('🔍 Validating Ollama setup...');
  console.log(`   URL: ${OLLAMA_URL_SAFE}`);
  console.log(`   Embedding Model: ${EMBEDDING_MODEL_SAFE}`);
  console.log(`   Embedding Format: ${EMBEDDING_FORMAT_SAFE}`);
  console.log(`   Chat Model: ${CHAT_MODEL_SAFE}`);

  // Check health
  const isHealthy = await checkOllamaHealth();
  if (!isHealthy) {
    throw new Error(
      `Ollama is not running or not accessible at ${OLLAMA_URL_SAFE}. ` +
      `Please ensure Ollama is running: 'ollama serve'`
    );
  }
  console.log('   ✅ Ollama is running');

  // Check models availability
  const availableModels = await getAvailableModels();
  const embeddingModelAvailable = availableModels.includes(EMBEDDING_MODEL_SAFE);
  const chatModelAvailable = availableModels.includes(CHAT_MODEL_SAFE);

  if (!embeddingModelAvailable) {
    throw new Error(
      `Embedding model '${EMBEDDING_MODEL_SAFE}' not found. ` +
      `Pull it with: 'ollama pull ${EMBEDDING_MODEL_SAFE}'`
    );
  }
  console.log(`   ✅ Embedding model '${EMBEDDING_MODEL_SAFE}' available`);

  if (!chatModelAvailable) {
    throw new Error(
      `Chat model '${CHAT_MODEL_SAFE}' not found. ` +
      `Pull it with: 'ollama pull ${CHAT_MODEL_SAFE}'`
    );
  }
  console.log(`   ✅ Chat model '${CHAT_MODEL_SAFE}' available`);

  console.log('✅ Ollama setup validation complete\n');
}

/**
 * Get system information about Ollama
 */
export async function getOllamaInfo(): Promise<{
  url: string;
  embeddingModel: string;
  embeddingFormat: string;
  chatModel: string;
  timeout: number;
}> {
  return {
    url: OLLAMA_URL_SAFE,
    embeddingModel: EMBEDDING_MODEL_SAFE,
    embeddingFormat: EMBEDDING_FORMAT_SAFE,
    chatModel: CHAT_MODEL_SAFE,
    timeout: REQUEST_TIMEOUT,
  };
}
