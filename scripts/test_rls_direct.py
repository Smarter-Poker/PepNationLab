import os
import psycopg2

db_url = os.getenv("DATABASE_URL")
# Wait, I don't have DATABASE_URL for psycopg2.
