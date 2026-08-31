import { PollyClient, SynthesizeSpeechCommand, Engine } from '@aws-sdk/client-polly';
import { config } from '../../config';

// One neural voice per supported language (ISO 639-1). Falls back to
// English if a language has no mapped voice yet.
const VOICE_MAP: Record<string, string> = {
  en: 'Joanna',
  es: 'Lucia',
  fr: 'Lea',
  de: 'Vicki',
  pt: 'Camila',
  it: 'Bianca',
  ja: 'Takumi',
  ko: 'Seoyeon',
  cmn: 'Zhiyu',
  zh: 'Zhiyu',
  arb: 'Zeina',
  ar: 'Zeina',
  hi: 'Kajal',
  nl: 'Laura',
  pl: 'Ola',
  tr: 'Filiz',
  sv: 'Elin',
};

const DEFAULT_VOICE = 'Joanna';

// Amazon Polly's real-time SynthesizeSpeech API caps input around 3000
// billed characters. We chunk long chapters on sentence boundaries and
// stitch the resulting MP3 buffers together.
const MAX_CHUNK_CHARS = 2900;

export class PollyService {
  private static client = new PollyClient({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });

  static voiceForLanguage(language: string): string {
    return VOICE_MAP[language] ?? DEFAULT_VOICE;
  }

  /** Split text into ≤MAX_CHUNK_CHARS pieces, preferring sentence boundaries. */
  static chunkText(text: string): string[] {
    const chunks: string[] = [];
    let remaining = text.trim();

    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHUNK_CHARS) {
        chunks.push(remaining);
        break;
      }

      let splitAt = remaining.lastIndexOf('. ', MAX_CHUNK_CHARS);
      if (splitAt < MAX_CHUNK_CHARS * 0.5) {
        splitAt = remaining.lastIndexOf(' ', MAX_CHUNK_CHARS);
      }
      if (splitAt <= 0) {
        splitAt = MAX_CHUNK_CHARS;
      }

      chunks.push(remaining.slice(0, splitAt + 1).trim());
      remaining = remaining.slice(splitAt + 1).trim();
    }

    return chunks;
  }

  /**
   * Synthesize full chapter text to a single MP3 buffer.
   * Uses the neural engine where available, falling back to standard.
   */
  static async synthesize(text: string, language: string): Promise<Buffer> {
    const voiceId = PollyService.voiceForLanguage(language);
    const chunks = PollyService.chunkText(text);
    const buffers: Buffer[] = [];

    for (const chunk of chunks) {
      const buffer = await PollyService.synthesizeChunk(chunk, voiceId);
      buffers.push(buffer);
    }

    return Buffer.concat(buffers);
  }

  private static async synthesizeChunk(
    text: string,
    voiceId: string,
    engine: Engine = 'neural',
  ): Promise<Buffer> {
    try {
      return await PollyService.callPolly(text, voiceId, engine);
    } catch (err: any) {
      // Not every voice supports the neural engine — retry on standard.
      if (engine === 'neural') {
        return PollyService.callPolly(text, voiceId, 'standard');
      }
      throw err;
    }
  }

  private static async callPolly(
    text: string,
    voiceId: string,
    engine: Engine,
  ): Promise<Buffer> {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      TextType: 'text',
      VoiceId: voiceId as any,
      OutputFormat: 'mp3',
      Engine: engine,
    });

    const response = await PollyService.client.send(command);

    if (!response.AudioStream) {
      throw new Error('Polly returned no audio stream');
    }

    const bytes = await response.AudioStream.transformToByteArray();
    return Buffer.from(bytes);
  }
}
