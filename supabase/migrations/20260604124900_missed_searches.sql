create table if not exists missed_searches (
    id uuid default gen_random_uuid() primary key,
    query text not null,
    source text not null default 'storefront',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists missed_searches_query_idx on missed_searches (query);
create index if not exists missed_searches_created_at_idx on missed_searches (created_at);

alter table missed_searches enable row level security;

create policy "Allow insert from anyone" on missed_searches
    for insert
    to public
    with check (true);

create policy "Allow read for service role only" on missed_searches
    for select
    to service_role
    using (true);
