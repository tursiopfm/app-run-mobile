import { Decoder, Stream } from '@garmin/fitsdk'
import { recordsToStreamSet, downsample5s, type FitRecord } from './fit-transform'
import type { FitDecoded } from './enrich-types'

/** Décode des octets FIT → streams downsamplés (5 s) + timestamp de début. */
export function decodeFitToStreams(bytes: Uint8Array): FitDecoded {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  const { messages } = decoder.read({ convertDateTimesToDates: true, convertTypesToStrings: true })
  const records = (messages.recordMesgs ?? []) as FitRecord[]
  const fileId = (messages.fileIdMesgs ?? [])[0] as { timeCreated?: Date } | undefined
  const startTimeMs =
    records[0]?.timestamp instanceof Date ? records[0].timestamp.getTime()
    : (fileId?.timeCreated instanceof Date ? fileId.timeCreated.getTime() : null)
  const streams = downsample5s(recordsToStreamSet(records))
  return { streams, startTimeMs, activityId: null }
}
