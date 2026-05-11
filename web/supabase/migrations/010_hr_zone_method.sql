-- 010_hr_zone_method.sql
-- Ajoute le stockage de la méthode active de calcul des zones FC
-- et les zones personnalisées (méthode 'custom').

alter table profiles
  add column if not exists hr_zone_method        text,
  add column if not exists hr_zones_custom       jsonb,
  add column if not exists hr_method_updated_at  timestamptz;

-- Valeurs autorisées : 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom'
-- hr_zones_custom uniquement si hr_zone_method = 'custom'
-- Format JSON : [{"zone":1,"min":null,"max":120},...,{"zone":5,"min":156,"max":190}]

alter table profiles
  add constraint hr_zone_method_check
  check (hr_zone_method is null or hr_zone_method in (
    'seuils','test30','karvonen','pct_max','auto','deduced','custom'
  ));
