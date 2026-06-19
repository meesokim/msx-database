import os
import xml.etree.ElementTree as ET
import json
import urllib.request
import urllib.parse
import time

CACHE_FILE = "title_translations.json"

def load_cache():
    if os.path.exists(CACHE_FILE):
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
    except Exception as e:
        print(f"Error saving cache: {e}")

def translate_batch(texts, target_lang='ko', source_lang='en'):
    if not texts:
        return []
    
    combined_text = "\n".join(texts)
    encoded_text = urllib.parse.quote(combined_text)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded_text}"
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            translated_segments = []
            if data and data[0]:
                for segment in data[0]:
                    if segment[0]:
                        translated_segments.append(segment[0])
            
            translated_full = "".join(translated_segments)
            translated_list = [t.strip() for t in translated_full.split("\n") if t.strip()]
            
            if len(translated_list) == len(texts):
                return translated_list
            else:
                print(f"Warning: Batch length mismatch ({len(texts)} vs {len(translated_list)}). Falling back to individual translation.")
                individual_results = []
                for t in texts:
                    res = translate_individual(t)
                    individual_results.append(res)
                    time.sleep(0.1)
                return individual_results
    except Exception as e:
        print(f"Batch translation request failed: {e}")
        # Fall back to individual translation
        individual_results = []
        for t in texts:
            res = translate_individual(t)
            individual_results.append(res)
            time.sleep(0.1)
        return individual_results

def translate_individual(text, target_lang='ko', source_lang='en'):
    encoded_text = urllib.parse.quote(text)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded_text}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and data[0] and data[0][0] and data[0][0][0]:
                return data[0][0][0].strip()
    except Exception as e:
        print(f"Individual translation failed for '{text}': {e}")
    return text

def extract_all_titles(directory):
    titles = set()
    files = sorted(os.listdir(directory))
    for f in files:
        if not f.startswith("msx"):
            continue
        filepath = os.path.join(directory, f)
        if f.endswith(".xml"):
            try:
                tree = ET.parse(filepath)
                for sw in tree.getroot().findall('software'):
                    desc_el = sw.find('description')
                    if desc_el is not None and desc_el.text:
                        titles.add(desc_el.text.strip())
            except Exception as e:
                print(f"Error parsing XML for titles: {f}: {e}")
        elif f.endswith(".hsi"):
            try:
                tree = ET.parse(filepath)
                for hash_el in tree.getroot().findall('hash'):
                    name = hash_el.attrib.get('name')
                    if name:
                        titles.add(name.strip())
            except Exception as e:
                print(f"Error parsing HSI for titles: {f}: {e}")
    return sorted(list(titles))

def main():
    directory = "/home/meesokim/msx-database"
    print("Extracting all game titles from database files...")
    titles = extract_all_titles(directory)
    print(f"Found {len(titles)} unique titles in total.")
    
    cache = load_cache()
    print(f"Loaded translation cache with {len(cache)} entries.")
    
    # Filter titles that need translation
    to_translate = [t for t in titles if t not in cache]
    print(f"{len(to_translate)} titles need translation.")
    
    if not to_translate:
        print("All titles are already translated in cache!")
        return

    # Process in batches
    batch_size = 80
    total_batches = (len(to_translate) + batch_size - 1) // batch_size
    
    print(f"Translating in {total_batches} batches of {batch_size}...")
    
    start_time = time.time()
    for i in range(0, len(to_translate), batch_size):
        batch_num = i // batch_size + 1
        batch_titles = to_translate[i : i + batch_size]
        
        print(f"Processing batch {batch_num}/{total_batches} ({len(batch_titles)} items)...")
        translated_titles = translate_batch(batch_titles)
        
        # Add to cache
        for orig, trans in zip(batch_titles, translated_titles):
            cache[orig] = trans
            
        # Periodically save cache to disk
        if batch_num % 5 == 0 or batch_num == total_batches:
            print("Saving translation cache to file...")
            save_cache(cache)
            
        # Pause slightly to avoid flooding the free endpoint
        time.sleep(0.3)
        
    end_time = time.time()
    print(f"Translation completed in {end_time - start_time:.2f} seconds.")
    print(f"Total cache size is now {len(cache)} entries.")

if __name__ == "__main__":
    main()
