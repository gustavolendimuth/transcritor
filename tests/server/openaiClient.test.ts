import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: createMock } },
  })),
}));

vi.mock('node:fs', () => ({
  default: { createReadStream: vi.fn(() => ({})) },
}));

import { createOpenAIClient } from '../../src/server/openaiClient.js';

describe('createOpenAIClient', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('uses gpt-4o-transcribe without timestamps and returns plain text', async () => {
    createMock.mockResolvedValueOnce({ text: 'ola mundo' });
    const client = createOpenAIClient('fake-key');
    const result = await client.transcribeChunk('/tmp/a.ogg', {
      withTimestamps: false,
      language: 'pt',
    });
    expect(result).toEqual({ text: 'ola mundo' });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-transcribe', language: 'pt' })
    );
    expect(createMock.mock.calls[0][0]).not.toHaveProperty('response_format');
  });

  it('uses whisper-1 with verbose_json and maps segments when withTimestamps is true', async () => {
    createMock.mockResolvedValueOnce({
      text: 'ola mundo',
      segments: [
        { start: 0, end: 1.2, text: ' Ola.' },
        { start: 1.2, end: 2.5, text: ' Mundo?' },
      ],
    });
    const client = createOpenAIClient('fake-key');
    const result = await client.transcribeChunk('/tmp/a.ogg', {
      withTimestamps: true,
      language: 'en',
    });
    expect(result).toEqual({
      text: 'ola mundo',
      segments: [
        { start: 0, text: 'Ola.' },
        { start: 1.2, text: 'Mundo?' },
      ],
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en',
      })
    );
  });

  it('treats a response with no segments as an empty segments array', async () => {
    createMock.mockResolvedValueOnce({ text: 'sem segmentos' });
    const client = createOpenAIClient('fake-key');
    const result = await client.transcribeChunk('/tmp/a.ogg', {
      withTimestamps: true,
      language: 'pt',
    });
    expect(result).toEqual({ text: 'sem segmentos', segments: [] });
  });

  it('wraps API failures in TranscriptionApiError', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    const client = createOpenAIClient('fake-key');
    await expect(
      client.transcribeChunk('/tmp/a.ogg', { withTimestamps: false, language: 'pt' })
    ).rejects.toThrow('Falha ao transcrever áudio via OpenAI');
  });
});
