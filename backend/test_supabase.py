import os
import sys
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load env variables
load_dotenv()

def test_connection():
    print("=" * 60)
    print("LARING AI - SUPABASE CONNECTION TEST")
    print("=" * 60)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        print("[-] Error: SUPABASE_URL or SUPABASE_KEY is missing in environment.")
        print("    Please create a '.env' file in the 'backend' folder with:")
        print("    SUPABASE_URL=https://your-project.supabase.co")
        print("    SUPABASE_KEY=your-anon-or-service-key")
        return False

    print(f"[+] Loaded URL: {url}")
    print(f"[+] Loaded Key: {key[:15]}...{key[-5:] if len(key) > 5 else ''}")

    try:
        from supabase import create_client, Client
        print("[+] Supabase package imported successfully.")
    except ImportError:
        print("[-] Error: 'supabase' package is not installed. Run 'pip install supabase python-dotenv' first.")
        return False

    try:
        client: Client = create_client(url, key)
        print("[+] Client initialized successfully.")
    except Exception as e:
        print(f"[-] Error: Failed to initialize Supabase client: {e}")
        return False

    # Test tables
    tables = ["security_alerts", "room_statistics", "game_leaderboard"]
    all_success = True

    print("\nTesting Database Tables:")
    print("-" * 40)
    for table in tables:
        try:
            # Query 1 item to check if table exists and is accessible
            res = client.table(table).select("*").limit(1).execute()
            print(f"[+] Table '{table}' exists and is accessible. (Records: {len(res.data)})")
        except Exception as e:
            print(f"[-] Table '{table}' error: {e}")
            print(f"    Make sure you ran the SQL scripts to create '{table}' table in Supabase!")
            all_success = False

    print("-" * 40)
    if all_success:
        print("[+++] SUCCESS: Supabase is fully configured and ready for Laring AI!")
    else:
        print("[-] WARNING: Some tables failed. Please check the SQL creation scripts in your Supabase SQL editor.")
    print("=" * 60)
    return all_success

if __name__ == "__main__":
    test_connection()
