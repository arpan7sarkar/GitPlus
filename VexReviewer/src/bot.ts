import {info, warning} from '@actions/core'
import {GoogleGenAI} from '@google/genai'
import pRetry from 'p-retry'
import {GeminiOptions, Options} from './options'

export interface Ids {
  parentMessageId?: string
  conversationId?: string
}

export class Bot {
  private readonly api: GoogleGenAI
  private readonly options: Options
  private readonly geminiOptions: GeminiOptions

  constructor(options: Options, geminiOptions: GeminiOptions) {
    this.options = options
    this.geminiOptions = geminiOptions
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      this.api = new GoogleGenAI({apiKey})
    } else {
      throw new Error(
        "Unable to initialize the Gemini API, 'GEMINI_API_KEY' environment variable is not available"
      )
    }
  }

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let res: [string, Ids] = ['', {}]
    try {
      res = await this.chat_(message, ids)
      return res
    } catch (e: any) {
      warning(`Failed to chat: ${e}, backtrace: ${e.stack}`)
      return res
    }
  }

  private readonly chat_ = async (
    message: string,
    ids: Ids
  ): Promise<[string, Ids]> => {
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }

    let responseText = ''

    try {
      const currentDate = new Date().toISOString().split('T')[0]
      const systemInstruction = `${this.options.systemMessage}
Knowledge cutoff: ${this.geminiOptions.tokenLimits.knowledgeCutOff}
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${this.options.language}
`

      const result = await pRetry(
        async () => {
          const response = await this.api.models.generateContent({
            model: this.geminiOptions.model,
            contents: message,
            config: {
              systemInstruction,
              temperature: this.options.geminiModelTemperature,
              maxOutputTokens: this.geminiOptions.tokenLimits.responseTokens
            }
          })

          return response.text ?? ''
        },
        {
          retries: this.options.geminiRetries
        }
      )

      responseText = result
    } catch (e: any) {
      warning(`failed to send message to gemini: ${e}, backtrace: ${e.stack}`)
    }

    const end = Date.now()
    info(
      `gemini sendMessage (including retries) response time: ${end - start} ms`
    )

    if (responseText === '') {
      warning('gemini response is empty')
    }

    if (responseText.startsWith('with ')) {
      responseText = responseText.substring(5)
    }

    if (this.options.debug) {
      info(`gemini responses: \n${responseText}`)
    }

    const newIds: Ids = {
      parentMessageId: Math.random().toString(36).substring(7),
      conversationId:
        ids.conversationId || Math.random().toString(36).substring(7)
    }
    return [responseText, newIds]
  }
}
