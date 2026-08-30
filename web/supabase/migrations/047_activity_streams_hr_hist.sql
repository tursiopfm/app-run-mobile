-- 047 : histogramme FC (temps par bpm) sur activity_streams.
--
-- Motif : recalculateUserEffortScores relisait streams_gz pour TOUS les streams
-- de l'utilisateur (~10 kB/ligne, ~10 MB par appel) uniquement pour recalculer
-- les temps par zone FC. L'histogramme (index = bpm, valeur = secondes) donne
-- exactement le même résultat pour ~1 kB, et supprime la relecture du stream
-- compressé — principal poste d'egress Supabase (cf. dépassement du quota Free
-- en août 2026 : 6,01 GB pour 5 GB inclus).
--
-- Nullable : les lignes antérieures au backfill retombent sur l'estimation
-- depuis la FC moyenne, comme une activité sans stream.

alter table activity_streams add column if not exists hr_time_hist integer[];

comment on column activity_streams.hr_time_hist is
  'Temps passé à chaque bpm : index = fréquence cardiaque, valeur = secondes. Dérivé de streams_gz à l''ingestion, évite de relire le stream au recalcul CES.';
