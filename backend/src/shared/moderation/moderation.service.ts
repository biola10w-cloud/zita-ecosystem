import axios from 'axios';
import { config } from '../../config';

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}

export class ModerationService {
  static isConfigured(): boolean {
    return !!config.OPENAI_API_KEY;
  }

  /**
   * Check text against OpenAI's Moderation API.
   * Fails open (not flagged) if moderation isn't configured or the API
   * errors — a comment shouldn't be silently blocked by an outage.
   */
  static async checkText(text: string): Promise<ModerationResult> {
    if (!ModerationService.isConfigured()) {
      return { flagged: false, categories: [] };
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/moderations',
        { input: text },
        {
          headers: {
            Authorization: `Bearer ${config.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );

      const result = response.data.results[0];
      const categories = Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([category]) => category);

      return { flagged: result.flagged, categories };
    } catch (err) {
      console.error('[moderation] OpenAI moderation check failed:', err);
      return { flagged: false, categories: [] };
    }
  }
}
