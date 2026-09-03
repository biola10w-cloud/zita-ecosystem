declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface ConversionOptions {
    styleMap?: string[];
  }

  function convertToHtml(input: { buffer: Buffer }, options?: ConversionOptions): Promise<ConversionResult>;

  export = { convertToHtml };
}
