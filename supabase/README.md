# Supabase Migrations

This directory contains SQL migrations for the flashcard application database.

## Prerequisites

- A Supabase project created (you'll do this manually)
- Access to the Supabase SQL Editor

## Running Migrations

Supabase does not currently support automatic migration running like traditional database tools. You must run these migrations manually in the Supabase SQL Editor:

1. **Create a Supabase project** at https://supabase.com
   - Sign up/login and create a new project
   - Save your project URL and API keys

2. **Run migrations in order** via Supabase SQL Editor:
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor** in the left sidebar
   - Create a new query for each migration file
   - Copy the contents of each migration file in order:
     1. `001_initial_schema.sql` - Creates all base tables and triggers
     2. `002_rls_policies.sql` - Enables RLS and creates security policies
     3. `003_seed_site_settings.sql` - Seeds initial configuration data
   - Run each query to completion

3. **Verify** that each migration ran successfully by checking for errors in the SQL Editor output

## Migration Files

- **001_initial_schema.sql** - Creates tables: words, daily_sets, daily_set_words, users, user_progress, site_settings. Includes the moddatetime extension for automatic updated_at timestamps.
- **002_rls_policies.sql** - Enables Row Level Security (RLS) on all tables with policies controlling read/write access based on authentication and user ownership.
- **003_seed_site_settings.sql** - Seeds the site_settings table with default configuration (7-day random exclusion window).

## Database Schema Overview

- **words** - Vocabulary items with English/Thai translations, images, and audio
- **daily_sets** - Daily word set collections with a unique date constraint
- **daily_set_words** - Junction table linking words to daily sets (positions 1-10)
- **users** - User accounts linked to auth.users with approval and admin flags
- **user_progress** - Tracks user performance on individual words (got_it/nope results)
- **site_settings** - Global configuration (currently stores random_exclusion_days)

## Notes

- RLS is enabled on all tables. The `service-role` key can bypass RLS and is used for admin operations.
- The `words` table requires manual UUID assignment or integration with application logic for generation.
- Foreign key constraints use `on delete cascade` for daily_sets and `on delete restrict` for words to prevent orphaned references.
