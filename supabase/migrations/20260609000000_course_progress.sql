-- Account-bound progress + quiz scoring for the Peptide 101 course.
-- Owner-RLS (mirrors user_saved_compounds); admin can read for completion analytics.
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course text not null default 'peptide-101',
  current_screen text,
  completed_modules jsonb not null default '[]'::jsonb,
  quiz_scores jsonb not null default '{}'::jsonb,
  assessment_score integer,
  assessment_total integer,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course)
);

alter table public.course_progress enable row level security;

drop policy if exists course_progress_owner_select on public.course_progress;
drop policy if exists course_progress_owner_insert on public.course_progress;
drop policy if exists course_progress_owner_update on public.course_progress;

create policy course_progress_owner_select on public.course_progress
  for select using (auth.uid() = user_id);
create policy course_progress_owner_insert on public.course_progress
  for insert with check (auth.uid() = user_id);
create policy course_progress_owner_update on public.course_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_course_progress()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_course_progress on public.course_progress;
create trigger trg_touch_course_progress
  before update on public.course_progress
  for each row execute function public.touch_course_progress();

grant select, insert, update on public.course_progress to authenticated;

drop policy if exists course_progress_admin_select on public.course_progress;
create policy course_progress_admin_select on public.course_progress
  for select using (public.is_admin());
