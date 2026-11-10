create or replace function public.nexus_read_collection_by_ids(
  p_collection text,
  p_ids text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_matching_records jsonb;
begin
  if p_collection is null or p_collection !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'INVALID_COLLECTION' using errcode = '22023';
  end if;

  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    return '[]'::jsonb;
  end if;

  if pg_catalog.cardinality(p_ids) > 5000
     or exists (
       select 1
         from pg_catalog.unnest(p_ids) as requested(id)
        where requested.id is null or requested.id = ''
     ) then
    raise exception 'INVALID_RECORD_IDS' using errcode = '22023';
  end if;

  select coalesce(
           pg_catalog.jsonb_agg(item.record order by item.ordinality),
           '[]'::jsonb
         )
    into v_matching_records
    from public.nexus_collections as stored
    cross join lateral pg_catalog.jsonb_array_elements(stored.records)
      with ordinality as item(record, ordinality)
   where stored.collection = p_collection
     and pg_catalog.jsonb_typeof(item.record) = 'object'
     and item.record ->> 'id' = any(p_ids);

  return v_matching_records;
end;
$function$;

revoke all on function public.nexus_read_collection_by_ids(text, text[])
  from public, authenticated;
grant execute on function public.nexus_read_collection_by_ids(text, text[])
  to anon;

notify pgrst, 'reload schema';
