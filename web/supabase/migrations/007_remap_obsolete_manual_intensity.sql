-- 007_remap_obsolete_manual_intensity.sql
-- Remap les anciennes valeurs manual_intensity supprimées de IntensityKey
-- (runtaf/velotaf/course sont désormais des WorkoutType, pas des intensités)
UPDATE activities SET manual_intensity = 'footing' WHERE manual_intensity = 'runtaf';
UPDATE activities SET manual_intensity = 'footing' WHERE manual_intensity = 'velotaf';
UPDATE activities SET manual_intensity = 'seuil'   WHERE manual_intensity = 'course';
