ALTER TABLE projects ADD COLUMN IF NOT EXISTS name text;
UPDATE projects SET name = 'Untitled Project' WHERE name IS NULL OR btrim(name) = '';
ALTER TABLE projects ALTER COLUMN name SET DEFAULT 'Untitled Project';
ALTER TABLE projects ALTER COLUMN name SET NOT NULL;
