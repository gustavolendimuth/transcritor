import fs from 'node:fs';
import OpenAI from 'openai';
import type { Language } from '../shared/languages.js';

export class TranscriptionApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TranscriptionApiError';
  }
}

export interface TranscribeSegment {
  start: number;
  text: string;
}

export interface TranscribeChunkResult {
  text: string;
  segments?: TranscribeSegment[];
}

export interface TranscribeChunkOptions {
  withTimestamps: boolean;
  language: Language;
}

export type TranscribeChunkFn = (
  filePath: string,
  options: TranscribeChunkOptions
) => Promise<TranscribeChunkResult>;

export function createOpenAIClient(apiKey: string): { transcribeChunk: TranscribeChunkFn } {
  const client = new OpenAI({ apiKey });
  return {
    async transcribeChunk(filePath, { withTimestamps, language }) {
      try {
        if (withTimestamps) {
          const response = await client.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-1',
            response_format: 'verbose_json',
            language,
          });
          return {
            text: response.text,
            segments: (response.segments ?? []).map((segment) => ({
              start: segment.start,
              text: segment.text.trim(),
            })),
          };
        }
        const response = await client.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'gpt-4o-transcribe',
          language,
        });
        return { text: response.text };
      } catch (error) {
        throw new TranscriptionApiError('Falha ao transcrever áudio via OpenAI', error);
      }
    },
  };
}
