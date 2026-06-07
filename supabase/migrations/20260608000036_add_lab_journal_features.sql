-- Add folder_name and notes to researcher_comparisons
ALTER TABLE researcher_comparisons 
ADD COLUMN folder_name TEXT,
ADD COLUMN notes TEXT;
