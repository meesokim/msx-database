import urllib.request
import urllib.parse
import json
import time

def translate_batch(texts, target_lang='ko', source_lang='en'):
    # Join texts with newlines
    combined_text = "\n".join(texts)
    
    # URL encode
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
            # Split back by newline
            translated_list = [t.strip() for t in translated_full.split("\n")]
            return translated_list
    except Exception as e:
        print(f"Translation error: {e}")
        return []

def main():
    test_titles = [
        "Bomber Man Special (Japan)",
        "Jet Set Willy",
        "Pooyan (Japan)",
        "Star Force (Japan)",
        "Star Soldier (Japan)",
        "Takahashi Meijin no Boukenjima (Japan)",
        "Yakyuu Kyou (Japan)",
        "Baseball Craze",
        "National CF-3300",
        "Serial Interface (Netherlands)"
    ]
    
    result = translate_batch(test_titles)
    print(f"Original length: {len(test_titles)}")
    print(f"Translated length: {len(result)}")
    for orig, trans in zip(test_titles, result):
        print(f"'{orig}' -> '{trans}'")

if __name__ == "__main__":
    main()
