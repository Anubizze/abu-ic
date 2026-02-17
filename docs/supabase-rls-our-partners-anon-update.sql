-- RLS: разрешить anon UPDATE и INSERT для our_partners
-- Иначе админка (использует anon key) не может сохранять pdf_file_url.

-- UPDATE для anon
CREATE POLICY "our_partners_anon_update"
ON public.our_partners
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- INSERT для anon (если добавляете партнёров из админки)
CREATE POLICY "our_partners_anon_insert"
ON public.our_partners
FOR INSERT
TO anon
WITH CHECK (true);

-- Опционально: DELETE для anon (если в админке есть удаление)
-- CREATE POLICY "our_partners_anon_delete"
-- ON public.our_partners FOR DELETE TO anon USING (true);
