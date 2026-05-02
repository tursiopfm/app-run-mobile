export type StravaWebhookEvent = {
  object_type:     'activity' | 'athlete'
  object_id:       number
  aspect_type:     'create' | 'update' | 'delete'
  owner_id:        number
  subscription_id: number
  event_time:      number
  updates?:        Record<string, unknown>
}
