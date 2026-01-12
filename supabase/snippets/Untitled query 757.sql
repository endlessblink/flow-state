  SELECT id, title, position->>'parentId' as parent_id, position->>'x' as x, position->>'y' as y
  FROM public.tasks
  WHERE position->>'parentId' IS NOT NULL;
