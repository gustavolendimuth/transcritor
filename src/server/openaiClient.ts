import fs from 'node:fs';
import OpenAI from 'openai';

export class TranscriptionApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TranscriptionApiError';
  }
}

export type TranscribeChunkFn = (filePath: string) => Promise<string>;

export function createOpenAIClient(apiKey: string): { transcribeChunk: TranscribeChunkFn } {
  const client = new OpenAI({ apiKey });
  return {
    async transcribeChunk(filePath: string): Promise<string> {
      try {
        const response = await client.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'gpt-4o-transcribe',
        });
        return response.text;
      } catch (error) {
        throw new TranscriptionApiError('Falha ao transcrever áudio via OpenAI', error);
      }
    },
  };
}
