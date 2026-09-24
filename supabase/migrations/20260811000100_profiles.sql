-- ============================================================================
-- Profiles: application-level user data, keyed to Supabase Auth's auth.users
-- ============================================================================
-- Auth identity/credentials live in Supabase-managed auth.users. This table
-- holds everything the app needs about a user. The primary key column is
-- named user_id (not id) to match every domain table's existing FK column
-- name, so none of them need renaming.

create table if not exists profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    phone_number varchar(30) default '',
    full_name varchar(255) not null default '',
    email varchar(255) default '',
    avatar_url text default '',
    occupation varchar(100) default '',
    city varchar(100) default '',
    state varchar(100) default '',
    pin_code varchar(10) default '',
    date_of_birth date,
    preferred_language varchar(10) default 'en',
    is_active boolean default true,
    kyc_verified boolean default false,
    onboarding_completed boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_profiles_phone on profiles(phone_number);

-- Populates `profiles` automatically whenever Supabase Auth creates a new
-- auth.users row (either via Email/Phone signup or Google OAuth).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (
        user_id, phone_number, full_name, email, occupation, city, state,
        pin_code, date_of_birth, preferred_language
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'phone_number', new.phone, ''),
        coalesce(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            new.raw_user_meta_data->>'user_name',
            split_part(coalesce(new.email, ''), '@', 1),
            'User'
        ),
        coalesce(new.email, new.raw_user_meta_data->>'email', ''),
        coalesce(new.raw_user_meta_data->>'occupation', 'Delivery Partner'),
        coalesce(new.raw_user_meta_data->>'city', 'Bengaluru'),
        coalesce(new.raw_user_meta_data->>'state', 'Karnataka'),
        coalesce(new.raw_user_meta_data->>'pin_code', ''),
        nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
        coalesce(new.raw_user_meta_data->>'preferred_language', 'en')
    )
    on conflict (user_id) do update set
        full_name = excluded.full_name,
        email = excluded.email,
        updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
