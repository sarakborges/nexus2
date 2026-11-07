create or replace function public.nexus_commit_collections(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_change jsonb;
  v_collection text;
  v_expected_text text;
  v_expected_updated_at timestamptz;
  v_actual_updated_at timestamptz;
  v_row_exists boolean;
begin
  if p_changes is null
     or pg_catalog.jsonb_typeof(p_changes) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_changes) = 0 then
    raise exception 'INVALID_COLLECTION_CHANGES' using errcode = '22023';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_changes) as item(value)
     group by item.value ->> 'collection'
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'DUPLICATE_COLLECTION_CHANGE' using errcode = '22023';
  end if;

  for v_change in
    select item.value
      from pg_catalog.jsonb_array_elements(p_changes) as item(value)
  loop
    v_collection := v_change ->> 'collection';

    if pg_catalog.jsonb_typeof(v_change) is distinct from 'object'
       or v_collection is null
       or v_collection !~ '^[a-zA-Z0-9_-]+$' then
      raise exception 'INVALID_COLLECTION_CHANGE' using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(v_change -> 'records') is distinct from 'array' then
      raise exception 'INVALID_COLLECTION_RECORDS' using errcode = '22023';
    end if;

    if v_change ? 'expected_updated_at'
       and v_change -> 'expected_updated_at' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(v_change -> 'expected_updated_at') is distinct from 'string' then
      raise exception 'INVALID_COLLECTION_VERSION' using errcode = '22023';
    end if;
  end loop;

  -- Every multi-collection transaction acquires locks in the same order.
  -- This also serializes transactions that create previously missing rows.
  for v_collection in
    select item.value ->> 'collection'
      from pg_catalog.jsonb_array_elements(p_changes) as item(value)
     order by item.value ->> 'collection'
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_collection, 0::bigint)
    );
  end loop;

  -- Lock and verify every existing row before changing any collection.
  for v_change in
    select item.value
      from pg_catalog.jsonb_array_elements(p_changes) as item(value)
     order by item.value ->> 'collection'
  loop
    v_collection := v_change ->> 'collection';
    v_expected_text := v_change ->> 'expected_updated_at';
    v_expected_updated_at := case
      when v_expected_text is null then null
      else v_expected_text::timestamptz
    end;

    select collection.updated_at
      into v_actual_updated_at
      from public.nexus_collections as collection
     where collection.collection = v_collection
     for update;

    v_row_exists := found;

    if v_expected_updated_at is null then
      if v_row_exists then
        return pg_catalog.jsonb_build_object('committed', false);
      end if;
    elsif not v_row_exists or v_actual_updated_at is distinct from v_expected_updated_at then
      return pg_catalog.jsonb_build_object('committed', false);
    end if;
  end loop;

  -- The function runs in one PostgreSQL transaction. Any failed write rolls
  -- back every preceding collection change in this call.
  for v_change in
    select item.value
      from pg_catalog.jsonb_array_elements(p_changes) as item(value)
     order by item.value ->> 'collection'
  loop
    v_collection := v_change ->> 'collection';
    v_expected_text := v_change ->> 'expected_updated_at';

    if v_expected_text is null then
      insert into public.nexus_collections (collection, records, updated_at)
      values (
        v_collection,
        v_change -> 'records',
        pg_catalog.clock_timestamp()
      );
    else
      update public.nexus_collections
         set records = v_change -> 'records',
             updated_at = greatest(
               pg_catalog.clock_timestamp(),
               updated_at + interval '1 microsecond'
             )
       where collection = v_collection;

      if not found then
        raise exception 'COLLECTION_DISAPPEARED_DURING_TRANSACTION'
          using errcode = '40001';
      end if;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('committed', true);
end;
$function$;

revoke all on function public.nexus_commit_collections(jsonb) from public, authenticated;
grant execute on function public.nexus_commit_collections(jsonb) to anon;

notify pgrst, 'reload schema';
