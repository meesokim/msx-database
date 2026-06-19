import os
import json
import urllib.request
import urllib.parse
import re
import time
import html

DIRECTORY = "/home/meesokim/msx-database"
DATA_FILE = os.path.join(DIRECTORY, "msx_data.js")
YT_LINKS_FILE = os.path.join(DIRECTORY, "youtube_links.json")

def load_games_for_youtube():
    if not os.path.exists(DATA_FILE):
        print(f"Data file not found: {DATA_FILE}")
        return {}
    
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        json_str = content.replace("// Automatically generated MSX Database file (abbreviated)\nconst MSX_RAW_DATA = ", "").rstrip(";\n")
        data = json.loads(json_str)
        
        # Extract unique English titles that have mapped screenshots
        # represented as dictionary of title -> ko_title
        games = {}
        for item in data:
            if item.get('t') and item.get('sf'):
                title = item['t'].strip()
                ko_title = item.get('kt', '').strip() if item.get('kt') else None
                games[title] = ko_title
                
        return games
    except Exception as e:
        print(f"Error loading game titles: {e}")
        return {}

def search_youtube(title, ko_title):
    # Formulate query
    if ko_title:
        query = f"MSX {title} {ko_title} gameplay"
    else:
        query = f"MSX {title} gameplay"
        
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.youtube.com/results?search_query={encoded_query}"
    
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            html_content = response.read().decode('utf-8', errors='ignore')
        
        # Look for videoId inside ytInitialData or directly in HTML
        video_ids = re.findall(r'"videoId":"([^"]+)"', html_content)
        if video_ids:
            # Return the first videoId
            return video_ids[0]
    except Exception as e:
        print(f"  -> Error querying YouTube for '{query}': {e}")
        
    return None

def main():
    if not os.path.exists(DIRECTORY):
        os.makedirs(DIRECTORY)
        
    games = load_games_for_youtube()
    print(f"Loaded {len(games)} unique games with screenshots from database.")
    
    # Load existing links
    yt_links = {}
    if os.path.exists(YT_LINKS_FILE):
        try:
            with open(YT_LINKS_FILE, "r", encoding="utf-8") as f:
                yt_links = json.load(f)
            print(f"Loaded {len(yt_links)} existing YouTube links from cache.")
        except Exception as e:
            print(f"Error loading existing YouTube links: {e}")
            
    # Filter out already fetched games
    to_fetch = []
    for title, ko_title in games.items():
        if title not in yt_links:
            to_fetch.append((title, ko_title))
            
    print(f"{len(to_fetch)} games need YouTube video search.")
    
    if not to_fetch:
        print("All YouTube links are already fetched and cached!")
        return
        
    # We will fetch a batch of up to 100 queries in this run
    max_fetches = 100
    fetched_count = 0
    
    print(f"Starting fetch of up to {max_fetches} YouTube links...")
    
    try:
        for idx, (title, ko_title) in enumerate(to_fetch[:max_fetches]):
            print(f"[{idx+1}/{max_fetches}] Querying: '{title}'" + (f" ({ko_title})" if ko_title else "") + "...")
            video_id = search_youtube(title, ko_title)
            
            if video_id:
                yt_links[title] = video_id
                fetched_count += 1
                print(f"  -> Found Video ID: {video_id}")
            else:
                print("  -> No video found.")
                
            time.sleep(1.0) # Polite delay to avoid rate limiting
            
            # Save progress incrementally
            if (idx + 1) % 10 == 0 or idx == len(to_fetch[:max_fetches]) - 1:
                with open(YT_LINKS_FILE, "w", encoding="utf-8") as f:
                    json.dump(yt_links, f, ensure_ascii=False, indent=2)
                print(f"  Saved progress to {YT_LINKS_FILE}")
                
    except KeyboardInterrupt:
        print("\nProcess interrupted. Saving progress...")
        with open(YT_LINKS_FILE, "w", encoding="utf-8") as f:
            json.dump(yt_links, f, ensure_ascii=False, indent=2)
            
    print(f"Completed run. Successfully fetched {fetched_count} YouTube video links.")
    print("To fetch more, re-run this script in your terminal:")
    print(f"  python3 {os.path.join(DIRECTORY, 'fetch_youtube_links.py')}")

if __name__ == "__main__":
    main()
