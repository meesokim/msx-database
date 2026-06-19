import os
import json
import urllib.request
import urllib.parse
import time
import re

DIRECTORY = "/home/meesokim/msx-database"
SCREENSHOTS_DIR = os.path.join(DIRECTORY, "screenshots")
DATA_FILE = os.path.join(DIRECTORY, "msx_data.js")

def sanitize_filename(filename):
    # Keep alphanumeric, spaces, parentheses, brackets, hyphens, and dots
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def load_game_screenshots():
    if not os.path.exists(DATA_FILE):
        print(f"Data file not found: {DATA_FILE}")
        return []
    
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        json_str = content.replace("// Automatically generated MSX Database file (abbreviated)\nconst MSX_RAW_DATA = ", "").rstrip(";\n")
        data = json.loads(json_str)
        
        # Extract unique English titles that have mapped screenshots
        games = []
        seen_titles = set()
        for item in data:
            if item.get('t') and item.get('sf'):
                title = item['t'].strip()
                if title not in seen_titles:
                    seen_titles.add(title)
                    games.append({
                        'title': title,
                        'sf': item['sf']
                    })
        return sorted(games, key=lambda x: x['title'])
    except Exception as e:
        print(f"Error loading game screenshots: {e}")
        return []

def download_screenshot(title, sf):
    safe_title = sanitize_filename(title)
    local_path = os.path.join(SCREENSHOTS_DIR, f"{safe_title}.png")
    
    if os.path.exists(local_path):
        # Already downloaded
        return True
        
    # URL encode the sf path and specifically parentheses
    encoded_path = urllib.parse.quote(sf).replace("%2F", "/").replace("(", "%28").replace(")", "%29")
    url = f"https://www.planetemu.net/screenshots/{encoded_path}"
    
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Referer': 'https://www.planetemu.net/'
        }
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            with open(local_path, "wb") as f:
                f.write(response.read())
        print(f"  -> Downloaded: '{title}'")
        return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            with open(local_path + ".404", "w") as f:
                f.write("")
            print(f"  -> No screenshot (404) for: '{title}'")
        else:
            print(f"  -> HTTP Error {e.code} for: '{title}'")
    except Exception as e:
        print(f"  -> Error downloading '{title}': {e}")
        
    return False

def main():
    if not os.path.exists(SCREENSHOTS_DIR):
        os.makedirs(SCREENSHOTS_DIR)
        print(f"Created screenshots directory: {SCREENSHOTS_DIR}")
        
    games = load_game_screenshots()
    print(f"Loaded {len(games)} unique games with screenshots from database.")
    
    # Filter out already downloaded or marked as 404
    to_download = []
    for g in games:
        title = g['title']
        safe_title = sanitize_filename(title)
        local_path = os.path.join(SCREENSHOTS_DIR, f"{safe_title}.png")
        marker_path = local_path + ".404"
        if not os.path.exists(local_path) and not os.path.exists(marker_path):
            to_download.append(g)
            
    print(f"{len(to_download)} screenshots need downloading.")
    
    if not to_download:
        print("All screenshots are already downloaded or marked as unavailable!")
        return
        
    # We will limit the downloads to a small batch.
    max_downloads = 50
    downloaded_count = 0
    
    print(f"Starting download of up to {max_downloads} screenshots...")
    for idx, g in enumerate(to_download[:max_downloads]):
        title = g['title']
        sf = g['sf']
        print(f"[{idx+1}/{max_downloads}] Processing: '{title}'...")
        success = download_screenshot(title, sf)
        if success:
            downloaded_count += 1
        time.sleep(0.5) # Polite delay
        
    print(f"Completed turn downloads. Downloaded {downloaded_count} screenshots.")
    print("To download the remaining screenshots, run in your terminal:")
    print(f"  python3 {os.path.join(DIRECTORY, 'download_screenshots.py')}")

if __name__ == "__main__":
    main()
