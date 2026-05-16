-- Migration 016 : étend les types de séance autorisés (velo, natation, renfo, musculation).

alter table planned_sessions  drop constraint if exists planned_sessions_type_check;
alter table planned_sessions  add  constraint planned_sessions_type_check
  check (type in ('sortie_longue','fractionne','seuil_tempo','cotes','course','runtaf','velotaf','footing','velo','natation','renfo','musculation'));

alter table session_templates drop constraint if exists session_templates_type_check;
alter table session_templates add  constraint session_templates_type_check
  check (type in ('sortie_longue','fractionne','seuil_tempo','cotes','course','runtaf','velotaf','footing','velo','natation','renfo','musculation'));
