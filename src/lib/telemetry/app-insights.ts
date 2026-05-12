// Azure Application Insights provider — placeholder.
//
// To implement: query the AI REST API
//   POST https://api.applicationinsights.io/v1/apps/{appId}/query
//   Authorization: Bearer <token>   (or x-api-key)
// with KQL like:
//   dependencies | where operation_Id == "<traceId>"
//   | union (requests | where operation_Id == "<traceId>")
// Map each row into our Span. customDimensions carries gen_ai_* keys.
//
// Register from index.ts only when both AI_APP_ID and AI_API_KEY are set.

import type { TelemetryProvider } from './types'

export interface AppInsightsConfig {
  appId: string
  apiKey: string
}

export function createAppInsightsProvider(_cfg: AppInsightsConfig): TelemetryProvider {
  throw new Error('App Insights provider not implemented yet')
}
