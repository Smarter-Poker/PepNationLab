import os
import psycopg2

db_url = os.getenv("DATABASE_URL")
# Oh wait, we didn't have DATABASE_URL before. I can use REST to fetch pg_policies.
