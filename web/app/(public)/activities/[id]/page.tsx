import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { getPublicActivity } from '@/lib/data/public-activity'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import { ActivityDetailClient } from './ActivityDetailClient'
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await getPublicActivity(id)
  const name = data?.activity.name
  return {
    title: name ? `${name} — Trail Cockpit` : 'Activité — Trail Cockpit',
    // « Non répertorié » : accessible par lien, mais pas indexé.
    robots: { index: false, follow: false },
    ...(name ? { openGraph: { title: name } } : {}),
  }
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getPublicActivity(id)
  if (!data) notFound()

  const user = await getServerUser()
  const isOwner = !!user && user.id === data.ownerId

  let activity = data.activity
  let splits = data.splits
  let laps = data.laps

  // Enrichissement Strava (splits/laps/calories) RÉSERVÉ au propriétaire :
  // utilise son propre token. Jamais d'appel Strava pour un visiteur.
  if (isOwner && (!splits || !laps) && activity.provider === 'strava' && activity.provider_activity_id) {
    try {
      const token = await getValidStravaToken(user!.id)
      const detail = await fetchStravaActivity(token, Number(activity.provider_activity_id))
      const stravaDetail = detail as unknown as {
        splits_metric?: unknown[]
        laps?: unknown[]
        calories?: number
      }
      const supabase = await createClient()
      const rawPayload = (activity.raw_payload ?? {}) as Record<string, unknown>

      if (activity.calories == null && stravaDetail.calories != null) {
        await supabase
          .from('activities')
          .update({ calories: stravaDetail.calories })
          .eq('id', id)
          .eq('user_id', user!.id)
        activity = { ...activity, calories: stravaDetail.calories }
      }

      const payloadPatch: Record<string, unknown> = {}
      if (!splits && Array.isArray(stravaDetail.splits_metric)) {
        splits = stravaDetail.splits_metric as unknown as StravaSplit[]
        payloadPatch.splits_metric = stravaDetail.splits_metric
      }
      if (!laps && Array.isArray(stravaDetail.laps)) {
        laps = stravaDetail.laps as unknown as StravaLap[]
        payloadPatch.laps = stravaDetail.laps
      } else if (!laps) {
        laps = []
        payloadPatch.laps = []
      }

      if (Object.keys(payloadPatch).length > 0) {
        await supabase
          .from('activities')
          .update({ raw_payload: { ...rawPayload, ...payloadPatch } })
          .eq('id', id)
          .eq('user_id', user!.id)
      }
    } catch {
      // Token expiré ou rate limité — afficher la page sans splits/laps.
    }
  }

  return (
    <ActivityDetailClient
      activity={activity}
      splits={splits}
      laps={laps}
      athleteProfile={data.athleteProfile}
      hrStream={data.hrStream}
      readOnly={!isOwner}
    />
  )
}
