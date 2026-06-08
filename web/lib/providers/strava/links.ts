// Deep-links publics Strava (conformité marque « View on Strava »).
const STRAVA_BASE_URL = 'https://www.strava.com'

/** URL publique de la page Strava d'une activité. */
export function stravaActivityUrl(providerActivityId: string | number): string {
  return `${STRAVA_BASE_URL}/activities/${providerActivityId}`
}
