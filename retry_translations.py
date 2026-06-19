import json
import urllib.request
import urllib.parse
import time
import re

CACHE_FILE = "title_translations.json"

def load_cache():
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading cache: {e}")
        return {}

def save_cache(cache):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        print("Cache saved successfully.")
    except Exception as e:
        print(f"Error saving cache: {e}")

def translate_individual(text, target_lang='ko', source_lang='en'):
    encoded_text = urllib.parse.quote(text)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded_text}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and data[0] and data[0][0] and data[0][0][0]:
                return data[0][0][0].strip()
    except Exception as e:
        print(f"Individual translation failed for '{text}': {e}")
    return None

def main():
    cache = load_cache()
    if not cache:
        print("No cache loaded. Exiting.")
        return

    # Find keys that have same value, are not ZZZ-UNK, and contain lowercase letters
    to_retry = [
        k for k, v in cache.items() 
        if k == v and not k.startswith("ZZZ-UNK-") and re.search(r"[a-z]", k)
    ]
    
    print(f"Found {len(to_retry)} candidates to retry translation.")
    
    if not to_retry:
        print("No candidates to retry.")
        return
        
    updated_count = 0
    for idx, k in enumerate(to_retry):
        print(f"[{idx+1}/{len(to_retry)}] Translating: '{k}'...")
        translated = translate_individual(k)
        if translated and translated != k:
            print(f"  -> Success: '{translated}'")
            cache[k] = translated
            updated_count += 1
        else:
            print("  -> Failed or no change.")
        
        # Save cache every 10 updates
        if updated_count > 0 and updated_count % 10 == 0:
            save_cache(cache)
            
        # Polite delay to avoid 500/429
        time.sleep(1.0)
        
    if updated_count > 0:
        save_cache(cache)
        print(f"Completed retry. Updated {updated_count} translations.")
    else:
        print("Completed retry. No translations were updated.")

if __name__ == "__main__":
    main()
