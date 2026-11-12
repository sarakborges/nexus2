create or replace function public.nexus_create_account_with_refresh_token(
  p_account_id uuid,p_email text,p_password_hash text,p_password_salt text,
  p_refresh_token_id uuid,p_refresh_token_hash text,
  p_refresh_token_expires_at_ms bigint,p_now_ms bigint
)
returns void
language plpgsql security invoker set search_path=''
as $function$
begin
  perform private.nexus_lock_collection_versions(array['accounts','refresh_tokens']::text[]);
  if p_account_id is null or p_refresh_token_id is null
     or nullif(btrim(p_email),'') is null
     or nullif(p_password_hash,'') is null or nullif(p_password_salt,'') is null
     or nullif(p_refresh_token_hash,'') is null
     or p_refresh_token_expires_at_ms is null or p_now_ms is null
     or p_refresh_token_expires_at_ms<=p_now_ms then
    raise exception 'INVALID_ACCOUNT_SIGNUP' using errcode='22023';
  end if;
  if exists(select 1 from public.accounts account where account.email=p_email) then
    raise exception 'EMAIL_ALREADY_EXISTS' using errcode='23505';
  end if;

  insert into public.accounts(id,email,password_hash,password_salt,current_profile_id)
  values(p_account_id,p_email,p_password_hash,p_password_salt,null);
  delete from public.refresh_tokens where expires_at_ms<=p_now_ms;
  insert into public.refresh_tokens(id,user_id,token_hash,expires_at_ms)
  values(p_refresh_token_id,p_account_id,p_refresh_token_hash,p_refresh_token_expires_at_ms);
  perform private.nexus_bump_collection_versions(array['accounts','refresh_tokens']::text[]);
end;
$function$;

create or replace function public.nexus_update_account_preferences(
  p_user_id uuid,p_language text,p_theme text
)
returns table(language text,theme text)
language plpgsql security invoker set search_path=''
as $function$
begin
  perform private.nexus_lock_collection_versions(array['accounts']::text[]);
  if p_user_id is null or p_language not in ('system','pt-BR','en-US')
     or p_theme not in ('system','light','dark') then
    raise exception 'INVALID_ACCOUNT_PREFERENCES' using errcode='22023';
  end if;
  if not exists(select 1 from public.accounts account where account.id=p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
  end if;
  insert into public.account_preferences(account_id,language,theme)
  values(p_user_id,p_language,p_theme)
  on conflict(account_id) do update
    set language=excluded.language,theme=excluded.theme;
  perform private.nexus_bump_collection_versions(array['accounts']::text[]);
  return query select p_language,p_theme;
end;
$function$;

revoke all on function public.nexus_create_account_with_refresh_token(uuid,text,text,text,uuid,text,bigint,bigint) from public,authenticated;
revoke all on function public.nexus_update_account_preferences(uuid,text,text) from public,authenticated;
grant execute on function public.nexus_create_account_with_refresh_token(uuid,text,text,text,uuid,text,bigint,bigint) to anon;
grant execute on function public.nexus_update_account_preferences(uuid,text,text) to anon;
notify pgrst,'reload schema';
