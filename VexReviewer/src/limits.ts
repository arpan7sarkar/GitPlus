export class TokenLimits {
  maxTokens: number
  requestTokens: number
  responseTokens: number
  knowledgeCutOff: string

  constructor(model = 'gemini-1.5-flash') {
    this.knowledgeCutOff = '2024-04-01'
    if (model === 'gemini-2.5-pro' || model === 'gemini-2.0-pro') {
      this.maxTokens = 1048576
      this.responseTokens = 65536
    } else if (
      model === 'gemini-2.5-flash' ||
      model === 'gemini-2.0-flash' ||
      model === 'gemini-2.0-flash-lite'
    ) {
      this.maxTokens = 1048576
      this.responseTokens = 32768
    } else if (
      model === 'gemini-1.5-pro' ||
      model === 'gemini-1.5-pro-latest'
    ) {
      this.maxTokens = 2097152
      this.responseTokens = 8192
    } else if (
      model === 'gemini-1.5-flash' ||
      model === 'gemini-1.5-flash-latest' ||
      model === 'gemini-1.5-flash-8b'
    ) {
      this.maxTokens = 1048576
      this.responseTokens = 8192
    } else {
      // fallback for unknown gemini models
      this.maxTokens = 32768
      this.responseTokens = 4096
    }
    // provide some margin for the request tokens
    this.requestTokens = this.maxTokens - this.responseTokens - 100
  }

  string(): string {
    return `max_tokens=${this.maxTokens}, request_tokens=${this.requestTokens}, response_tokens=${this.responseTokens}`
  }
}
