-- Let the application sign a temporary download address for a Paid Deliverable.
--
-- Issue #12 hands a buyer a short-lived signed link after Order Access has
-- already been proved (`commerce_download_target`). Storage cannot see that
-- token, so the policy below is the other half of the hand-over: the anonymous
-- role the server uses to sign may SELECT objects in this bucket.
--
-- The bucket stays private (no public URL). Object names are content-addressed
-- (SKU + checksum), so they are not guessed from a product page. There is still
-- no update or delete, and no staff SELECT: operators never read a Paid
-- Deliverable through their session. The anonymous key is server-only
-- (ADR-0003); it is not compiled into the browser.

drop policy if exists "The application may sign Paid Deliverable downloads"
  on storage.objects;
create policy "The application may sign Paid Deliverable downloads"
  on storage.objects for select to anon
  using (bucket_id = 'paid-deliverables');
