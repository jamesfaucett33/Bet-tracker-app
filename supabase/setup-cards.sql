-- Shared bet cards: the image (and a little JSON with its title) behind each
-- betkeyper.com/c/<user>/<card> link. Run once in the Supabase SQL editor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 2097152, array['image/png', 'application/json'])
on conflict (id) do nothing;

-- Signed-in people can add cards only in their own folder.
create policy "upload own cards" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cards' and (storage.foldername(name))[1] = auth.uid()::text);
