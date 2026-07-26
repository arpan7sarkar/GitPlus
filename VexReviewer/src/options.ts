import {info} from '@actions/core'
import {minimatch} from 'minimatch'
import {TokenLimits} from './limits'

export class Options {
  debug: boolean
  disableReview: boolean
  disableReleaseNotes: boolean
  maxFiles: number
  reviewSimpleChanges: boolean
  reviewCommentLGTM: boolean
  pathFilters: PathFilter
  systemMessage: string
  geminiLightModel: string
  geminiHeavyModel: string
  geminiModelTemperature: number
  geminiRetries: number
  geminiTimeoutMS: number
  geminiConcurrencyLimit: number
  githubConcurrencyLimit: number
  lightTokenLimits: TokenLimits
  heavyTokenLimits: TokenLimits
  language: string

  constructor(
    debug: boolean,
    disableReview: boolean,
    disableReleaseNotes: boolean,
    maxFiles = '0',
    reviewSimpleChanges = false,
    reviewCommentLGTM = false,
    pathFilters: string[] | null = null,
    systemMessage = '',
    geminiLightModel = 'gemini-flash-latest',
    geminiHeavyModel = 'gemini-flash-latest',
    geminiModelTemperature = '0.7',
    geminiRetries = '3',
    geminiTimeoutMS = '120000',
    geminiConcurrencyLimit = '6',
    githubConcurrencyLimit = '6',
    language = 'en-US'
  ) {
    this.debug = debug
    this.disableReview =
      process.env.DISABLE_REVIEW === 'true' || disableReview
    this.disableReleaseNotes =
      process.env.DISABLE_RELEASE_NOTES === 'true' || disableReleaseNotes
    this.maxFiles = parseInt(process.env.MAX_FILES || maxFiles)
    this.reviewSimpleChanges =
      process.env.REVIEW_SIMPLE_CHANGES === 'true' || reviewSimpleChanges
    this.reviewCommentLGTM =
      process.env.REVIEW_COMMENT_LGTM === 'true' || reviewCommentLGTM
    this.pathFilters = new PathFilter(
      pathFilters || process.env.PATH_FILTERS?.split('\n') || null
    )
    this.systemMessage = process.env.SYSTEM_MESSAGE || systemMessage
    this.geminiLightModel =
      process.env.GEMINI_LIGHT_MODEL || geminiLightModel
    this.geminiHeavyModel =
      process.env.GEMINI_HEAVY_MODEL || geminiHeavyModel
    this.geminiModelTemperature = parseFloat(
      process.env.GEMINI_MODEL_TEMPERATURE || geminiModelTemperature
    )
    this.geminiRetries = parseInt(
      process.env.GEMINI_RETRIES || geminiRetries
    )
    this.geminiTimeoutMS = parseInt(
      process.env.GEMINI_TIMEOUT_MS || geminiTimeoutMS
    )
    this.geminiConcurrencyLimit = parseInt(
      process.env.GEMINI_CONCURRENCY_LIMIT || geminiConcurrencyLimit
    )
    this.githubConcurrencyLimit = parseInt(
      process.env.GITHUB_CONCURRENCY_LIMIT || githubConcurrencyLimit
    )
    this.lightTokenLimits = new TokenLimits(this.geminiLightModel)
    this.heavyTokenLimits = new TokenLimits(this.geminiHeavyModel)
    this.language = process.env.LANGUAGE || language
  }

  // print all options using info
  print(): void {
    info(`debug: ${this.debug}`)
    info(`disable_review: ${this.disableReview}`)
    info(`disable_release_notes: ${this.disableReleaseNotes}`)
    info(`max_files: ${this.maxFiles}`)
    info(`review_simple_changes: ${this.reviewSimpleChanges}`)
    info(`review_comment_lgtm: ${this.reviewCommentLGTM}`)
    info(`path_filters: ${this.pathFilters}`)
    info(`system_message: ${this.systemMessage}`)
    info(`gemini_light_model: ${this.geminiLightModel}`)
    info(`gemini_heavy_model: ${this.geminiHeavyModel}`)
    info(`gemini_model_temperature: ${this.geminiModelTemperature}`)
    info(`gemini_retries: ${this.geminiRetries}`)
    info(`gemini_timeout_ms: ${this.geminiTimeoutMS}`)
    info(`gemini_concurrency_limit: ${this.geminiConcurrencyLimit}`)
    info(`github_concurrency_limit: ${this.githubConcurrencyLimit}`)
    info(`summary_token_limits: ${this.lightTokenLimits.string()}`)
    info(`review_token_limits: ${this.heavyTokenLimits.string()}`)
    info(`language: ${this.language}`)
  }

  checkPath(path: string): boolean {
    const ok = this.pathFilters.check(path)
    info(`checking path: ${path} => ${ok}`)
    return ok
  }
}

export class PathFilter {
  private readonly rules: Array<[string /* rule */, boolean /* exclude */]>

  constructor(rules: string[] | null = null) {
    this.rules = []
    if (rules != null) {
      for (const rule of rules) {
        const trimmed = rule?.trim()
        if (trimmed) {
          if (trimmed.startsWith('!')) {
            this.rules.push([trimmed.substring(1).trim(), true])
          } else {
            this.rules.push([trimmed, false])
          }
        }
      }
    }
  }

  check(path: string): boolean {
    if (this.rules.length === 0) {
      return true
    }

    let included = false
    let excluded = false
    let inclusionRuleExists = false

    for (const [rule, exclude] of this.rules) {
      if (minimatch(path, rule)) {
        if (exclude) {
          excluded = true
        } else {
          included = true
        }
      }
      if (!exclude) {
        inclusionRuleExists = true
      }
    }

    return (!inclusionRuleExists || included) && !excluded
  }
}

export class GeminiOptions {
  model: string
  tokenLimits: TokenLimits

  constructor(
    model = 'gemini-1.5-flash',
    tokenLimits: TokenLimits | null = null
  ) {
    this.model = model
    if (tokenLimits != null) {
      this.tokenLimits = tokenLimits
    } else {
      this.tokenLimits = new TokenLimits(model)
    }
  }
}
