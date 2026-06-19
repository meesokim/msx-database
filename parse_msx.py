import os
import xml.etree.ElementTree as ET
import json
import re
import html
import urllib.parse

def normalize_year(year_str):
    if not year_str:
        return 'Unknown'
    year_str = year_str.strip()
    if not any(c.isdigit() for c in year_str):
        return 'Unknown'
    cleaned = year_str.replace('?', '')
    if not cleaned:
        return 'Unknown'
    return cleaned

def normalize_title(t):
    if not t:
        return ''
    t = html.unescape(t)
    t = t.lower()
    t = t.replace('α', 'alpha')
    t = t.replace('&', 'and')
    # Remove all parentheses and brackets contents
    t = re.sub(r'\(.*?\)', '', t)
    t = re.sub(r'\[.*?\]', '', t)
    # Keep only alphanumeric characters
    t = re.sub(r'[^a-z0-9]', '', t)
    return t.strip()

def load_planetemu_screenshots(directory):
    screenshots = {}
    
    def parse_html(filename):
        filepath = os.path.join(directory, filename)
        if not os.path.exists(filepath):
            print(f"PlanetEmu file not found: {filename}")
            return
        
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            li_list = re.findall(r'<li\b[^>]*>.*?</li>', content, re.DOTALL)
            for li in li_list:
                name_match = re.search(r'<span class=\x22[^\x22]*screenshots__name[^\x22]*\x22>(.*?)</span>', li)
                if not name_match:
                    continue
                title = name_match.group(1).strip()
                
                # Check if it has screenshot (no noscreenshot.svg)
                if 'noscreenshot' not in li and 'noscreenshot.svg' not in li:
                    img_match = re.search(r'<img[^>]+src=\x22/screenshots/([^\x22]+)\x22', li)
                    if img_match:
                        screenshot_path = urllib.parse.unquote(img_match.group(1))
                        screenshots[title] = screenshot_path
        except Exception as e:
            print(f"Error parsing {filename}: {e}")

    parse_html("planetemu.html")
    parse_html("planetemu_msx2.html")
    print(f"Loaded {len(screenshots)} screenshots from PlanetEmu list files.")
    return screenshots

def parse_xml_file(filepath):
    filename = os.path.basename(filepath)
    category = "Other"
    if "cart" in filename:
        category = "Cartridge"
    elif "cass" in filename:
        category = "Cassette"
    elif "flop" in filename:
        category = "Floppy"
    elif "bee_card" in filename:
        category = "Bee Card"
    elif "softcard" in filename:
        category = "Softcard"
    elif "minicart" in filename:
        category = "Minicart"
    
    system = "MSX"
    if "msx1_" in filename:
        system = "MSX1"
    elif "msx2_" in filename:
        system = "MSX2"
    elif "msx2p_" in filename:
        system = "MSX2+"
    elif "msxr_" in filename:
        system = "MSX TurboR"
    elif "msx_" in filename:
        system = "MSX"

    print(f"Parsing XML: {filename} ({system} {category})...")
    
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing {filename}: {e}")
        return []
    
    db_desc = root.attrib.get('description', '')
    software_list = []
    
    for sw in root.findall('software'):
        name = sw.attrib.get('name', '')
        cloneof = sw.attrib.get('cloneof', None)
        supported = sw.attrib.get('supported', 'yes')
        
        description_elem = sw.find('description')
        description = description_elem.text if description_elem is not None else name
        
        year_elem = sw.find('year')
        year = normalize_year(year_elem.text) if year_elem is not None else 'Unknown'
        
        publisher_elem = sw.find('publisher')
        publisher = publisher_elem.text if publisher_elem is not None else 'Unknown'
        
        # Gather info tags
        alt_title = None
        serial = None
        usage = None
        other_infos = {}
        for info in sw.findall('info'):
            inf_name = info.attrib.get('name')
            inf_val = info.attrib.get('value')
            if inf_name == 'alt_title':
                alt_title = inf_val
            elif inf_name == 'serial':
                serial = inf_val
            elif inf_name == 'usage':
                usage = inf_val
            else:
                other_infos[inf_name] = inf_val
                
        notes_elem = sw.find('notes')
        notes = notes_elem.text if notes_elem is not None else None
        
        parts = []
        for part in sw.findall('part'):
            part_name = part.attrib.get('name', '')
            part_interface = part.attrib.get('interface', '')
            
            features = {}
            for feature in part.findall('feature'):
                feat_name = feature.attrib.get('name')
                feat_val = feature.attrib.get('value')
                features[feat_name] = feat_val
                
            roms = []
            dataarea = part.find('dataarea')
            if dataarea is not None:
                for rom in dataarea.findall('rom'):
                    roms.append({
                        'name': rom.attrib.get('name', ''),
                        'size': rom.attrib.get('size', ''),
                        'crc': rom.attrib.get('crc', ''),
                        'sha1': rom.attrib.get('sha1', ''),
                        'status': rom.attrib.get('status', 'good')
                    })
                for disk in dataarea.findall('disk'):
                    roms.append({
                        'name': disk.attrib.get('name', ''),
                        'size': disk.attrib.get('size', ''),
                        'crc': disk.attrib.get('crc', ''),
                        'sha1': disk.attrib.get('sha1', ''),
                        'status': disk.attrib.get('status', 'good')
                    })
            
            parts.append({
                'name': part_name,
                'interface': part_interface,
                'features': features,
                'roms': roms
            })
            
        software_list.append({
            'id': name,
            'title': description,
            'year': year,
            'publisher': publisher,
            'system': system,
            'category': category,
            'cloneof': cloneof,
            'supported': supported,
            'alt_title': alt_title,
            'serial': serial,
            'usage': usage,
            'notes': notes,
            'parts': parts,
            'db_file': filename,
            'db_desc': db_desc
        })
        
    return software_list

def parse_hsi_file(filepath):
    filename = os.path.basename(filepath)
    system = "MSX"
    if "msx2" in filename:
        system = "MSX2"
    elif "msx1" in filename:
        system = "MSX1"
        
    category = "Hash Database"
    print(f"Parsing HSI: {filename} ({system} {category})...")
    
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing {filename}: {e}")
        return []
    
    software_list = []
    
    for hash_el in root.findall('hash'):
        crc = hash_el.attrib.get('crc32', '')
        name = hash_el.attrib.get('name', '')
        
        year_elem = hash_el.find('year')
        year = year_elem.text if year_elem is not None else 'Unknown'
        
        manufacturer_elem = hash_el.find('manufacturer')
        manufacturer = manufacturer_elem.text if manufacturer_elem is not None else 'Unknown'
        
        extrainfo_elem = hash_el.find('extrainfo')
        extrainfo = extrainfo_elem.text if extrainfo_elem is not None else None
        
        status_elem = hash_el.find('status')
        status = status_elem.text if status_elem is not None else 'good'
        
        software_list.append({
            'id': crc,
            'title': name,
            'year': year,
            'publisher': manufacturer,
            'system': system,
            'category': category,
            'cloneof': None,
            'supported': 'yes',
            'alt_title': None,
            'serial': None,
            'usage': None,
            'notes': f"Mapper Type: {extrainfo}" if extrainfo else None,
            'parts': [{
                'name': 'rom',
                'interface': 'msx_cart',
                'features': {'mapper_id': extrainfo} if extrainfo else {},
                'roms': [{
                    'name': name,
                    'size': '',
                    'crc': crc,
                    'sha1': '',
                    'status': status
                }]
            }],
            'db_file': filename,
            'db_desc': 'MSX Cartridge CRC Hash Database'
        })
        
    return software_list

def abbreviate(item, translations_cache):
    abb = {}
    if item.get('id'): abb['i'] = item['id']
    if item.get('title'):
        title = item['title']
        abb['t'] = title
        if title in translations_cache:
            abb['kt'] = translations_cache[title]
    if item.get('sf'): abb['sf'] = item['sf']
    if item.get('yt'): abb['yt'] = item['yt']
    if item.get('year'): abb['y'] = item['year']
    if item.get('publisher'): abb['p'] = item['publisher']
    if item.get('system'): abb['s'] = item['system']
    if item.get('category'): abb['c'] = item['category']
    if item.get('cloneof'): abb['cl'] = item['cloneof']
    if item.get('supported') and item['supported'] != 'yes': abb['sp'] = item['supported']
    if item.get('alt_title'): abb['a'] = item['alt_title']
    if item.get('serial'): abb['sr'] = item['serial']
    if item.get('usage'): abb['u'] = item['usage']
    if item.get('notes'): abb['n'] = item['notes']
    if item.get('db_file'): abb['df'] = item['db_file']
    if item.get('db_desc'): abb['dd'] = item['db_desc']
    
    parts = []
    for p in item.get('parts', []):
        part_abb = {}
        if p.get('name'): part_abb['n'] = p['name']
        if p.get('interface'): part_abb['i'] = p['interface']
        if p.get('features'): part_abb['f'] = p['features']
        
        roms = []
        for r in p.get('roms', []):
            rom_abb = {}
            if r.get('name'): rom_abb['n'] = r['name']
            if r.get('size'): rom_abb['sz'] = r['size']
            if r.get('crc'): rom_abb['c'] = r['crc']
            if r.get('sha1'): rom_abb['sh'] = r['sha1']
            if r.get('status') and r['status'] != 'good': rom_abb['st'] = r['status']
            roms.append(rom_abb)
            
        if roms:
            part_abb['r'] = roms
        parts.append(part_abb)
        
    if parts:
        abb['pt'] = parts
    return abb

def main():
    directory = "/home/meesokim/msx-database"
    
    # Load translation cache
    translations_cache = {}
    cache_path = os.path.join(directory, "title_translations.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as cache_f:
                translations_cache = json.load(cache_f)
            print(f"Loaded {len(translations_cache)} translations from cache.")
        except Exception as e:
            print(f"Error loading translations cache: {e}")
            
    # Load PlanetEmu screenshots and build normalization lookup
    pe_screenshots = load_planetemu_screenshots(directory)
    screenshot_lookup = {}
    for title, path in pe_screenshots.items():
        norm = normalize_title(title)
        if norm:
            screenshot_lookup[norm] = path

    # Load YouTube links cache
    youtube_links = {}
    yt_links_path = os.path.join(directory, "youtube_links.json")
    if os.path.exists(yt_links_path):
        try:
            with open(yt_links_path, "r", encoding="utf-8") as yt_f:
                youtube_links = json.load(yt_f)
            print(f"Loaded {len(youtube_links)} YouTube links from cache.")
        except Exception as e:
            print(f"Error loading YouTube links cache: {e}")

    # Build a normalized YouTube lookup
    yt_lookup = {}
    for yt_title, yt_id in youtube_links.items():
        norm_yt = normalize_title(yt_title)
        if norm_yt:
            yt_lookup[norm_yt] = yt_id

    aliases = {
        'albatros': 'albatross',
        'algesnoyoku': 'algeesenotsubasa',
        'bifamu': 'vifam',
        'borfesu': 'barunba',
        'brotheradventure': '형제모험',
        'burutomartykikiippatsu': 'bullandmarty',
    }

    all_software = []
    
    files = sorted(os.listdir(directory))
    for f in files:
        if not f.startswith("msx"):
            continue
        filepath = os.path.join(directory, f)
        if f.endswith(".xml"):
            all_software.extend(parse_xml_file(filepath))
        # Exclude Hash Database HSI files completely
        # elif f.endswith(".hsi"):
        #     all_software.extend(parse_hsi_file(filepath))
            
    print(f"Total software entries collected: {len(all_software)}")
    
    # Map software entries to screenshots and YouTube videos
    mapped_count = 0
    yt_mapped_count = 0
    for item in all_software:
        title = item.get('title', '')
        norm = normalize_title(title)
        
        # 1. Screenshot mapping
        sf = None
        if norm in screenshot_lookup:
            sf = screenshot_lookup[norm]
        elif norm in aliases and aliases[norm] in screenshot_lookup:
            sf = screenshot_lookup[aliases[norm]]
        else:
            if len(norm) > 4:
                for pe_norm, path in screenshot_lookup.items():
                    if len(pe_norm) > 4:
                        if norm in pe_norm or pe_norm in norm:
                            sf = path
                            break
        if sf:
            item['sf'] = sf
            mapped_count += 1

        # 2. YouTube mapping
        yt = None
        if norm in yt_lookup:
            yt = yt_lookup[norm]
        elif norm in aliases and aliases[norm] in yt_lookup:
            yt = yt_lookup[aliases[norm]]
        else:
            if len(norm) > 4:
                for yt_norm, yt_id in yt_lookup.items():
                    if len(yt_norm) > 4:
                        if norm in yt_norm or yt_norm in norm:
                            yt = yt_id
                            break
        if yt:
            item['yt'] = yt
            yt_mapped_count += 1
            
    print(f"Mapped {mapped_count} software entries to screenshots.")
    print(f"Mapped {yt_mapped_count} / {len(all_software)} software entries to YouTube gameplay videos.")

    # Abbreviate entries to save file size
    abbreviated_software = [abbreviate(item, translations_cache) for item in all_software]
    
    output_js_path = os.path.join(directory, "msx_data.js")
    with open(output_js_path, "w", encoding="utf-8") as out:
        out.write("// Automatically generated MSX Database file (abbreviated)\n")
        out.write("const MSX_RAW_DATA = ")
        json.dump(abbreviated_software, out, ensure_ascii=False)
        out.write(";\n")
        
    print(f"Optimized dataset written to {output_js_path}")

if __name__ == "__main__":
    main()
