-- Two issues flagged by the security advisor after the initial schema:
-- 1. set_updated_at() had a mutable search_path (injection risk).
-- 2. handle_new_user, handle_new_household, and is_household_member are
--    SECURITY DEFINER functions that PostgREST was auto-exposing as public
--    RPC endpoints (/rest/v1/rpc/...) purely because they lived in `public`
--    — none of them are meant to be called directly by clients, only by
--    triggers and RLS policies.
--
-- Fix: give set_updated_at a locked search_path, and move the other three
-- into a `private` schema that PostgREST doesn't expose. Moving a function's
-- schema doesn't break existing triggers or RLS policies — both reference
-- the function by OID internally, not by re-resolved name.

create schema if not exists private;

alter function public.set_updated_at() set search_path = public;

alter function public.handle_new_user() set schema private;
alter function public.handle_new_household() set schema private;
alter function public.is_household_member(uuid) set schema private;
