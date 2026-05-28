-- Migration: merge email_list into app_settings
-- Run once in the Supabase SQL Editor after deploying the app update.

-- Step 1: upsert a base settings row if none exists
insert into app_settings (id, data)
values ('email_notifications', '{}'::jsonb)
on conflict (id) do nothing;

-- Step 2: merge each email_list row into the matching module's "to" field
update app_settings
set data = (
  select jsonb_object_agg(
    module_key,
    coalesce(data->module_key, '{}'::jsonb) || jsonb_build_object('to', el.emails)
  )
  from (
    select
      case module
        when 'rt'  then 'roadTestOutcome'
        when 'uni' then 'uniformOrderNew'
        when 'inj' then 'injuryReportNew'
        when 'acc' then 'accidentReportNew'
        when 'hir' then 'hiringRequestNew'
        when 'ins' then 'insuranceRequestNew'
        when 'dot' then 'dotCardNew'
      end as module_key,
      emails
    from email_list
    where module in ('rt','uni','inj','acc','hir','ins','dot')
      and emails <> ''
  ) el
  where module_key is not null
)
where id = 'email_notifications';

-- Step 3 (optional): drop the now-unused table
-- drop table email_list;
