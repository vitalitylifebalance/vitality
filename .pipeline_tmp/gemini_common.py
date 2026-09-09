import json
import base64
import time
import requests

with open('/Users/prueba/.claude/settings.json') as f:
    SETTINGS = json.load(f)
API_KEY = SETTINGS['env']['GEMINI_API_KEY']
MODEL = 'gemini-flash-latest'
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}'


def call_gemini(parts, max_retries=5):
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.2}
    }
    last_err = None
    for attempt in range(max_retries):
        try:
            resp = requests.post(URL, json=body, timeout=180)
            if resp.status_code == 429 or resp.status_code >= 500:
                last_err = f"HTTP {resp.status_code}: {resp.text[:300]}"
                print(f"  [retry {attempt+1}/{max_retries}] {last_err}")
                time.sleep(5)
                continue
            resp.raise_for_status()
            data = resp.json()
            if 'candidates' not in data:
                last_err = f"No candidates: {json.dumps(data)[:300]}"
                print(f"  [retry {attempt+1}/{max_retries}] {last_err}")
                time.sleep(5)
                continue
            text = data['candidates'][0]['content']['parts'][0]['text']
            return text
        except Exception as e:
            last_err = repr(e)
            print(f"  [retry {attempt+1}/{max_retries}] exception: {last_err}")
            time.sleep(5)
    raise RuntimeError(f"Gemini call failed after {max_retries} retries: {last_err}")


def extract_json(text):
    text = text.strip()
    if text.startswith('```'):
        text = text.split('\n', 1)[1]
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text)


def transcribe_wav_es(wav_path):
    with open(wav_path, 'rb') as f:
        audio_b64 = base64.b64encode(f.read()).decode('utf-8')
    prompt = (
        "Transcribe este audio en español EXACTAMENTE como se dice (testimonio real, "
        "no inventes ni embellezcas). Devuelve SOLO un JSON array de objetos con "
        "{start, end, texto} donde start/end son segundos (float, con decimales) y "
        "texto es un segmento de MAXIMO 7 palabras (corta las frases largas en varios "
        "segmentos consecutivos que cubran el audio completo sin huecos ni solapes). "
        "No incluyas nada mas que el JSON."
    )
    parts = [
        {"text": prompt},
        {"inline_data": {"mime_type": "audio/wav", "data": audio_b64}}
    ]
    text = call_gemini(parts)
    return extract_json(text)


def translate_segments(es_segments, target_lang_name, tone_note):
    prompt = (
        f"Traduce estos segmentos de un testimonio real de cliente al {target_lang_name}. "
        f"{tone_note} Manten el mismo numero de segmentos y los mismos valores start/end "
        "EXACTAMENTE iguales (no los cambies). Traduce el campo 'texto' de forma natural, "
        "hablada, fiel al significado original (no embellezcas ni añadas claims). "
        "Devuelve SOLO un JSON array con los mismos objetos {start, end, texto} traducidos.\n\n"
        f"Segmentos:\n{json.dumps(es_segments, ensure_ascii=False)}"
    )
    parts = [{"text": prompt}]
    text = call_gemini(parts)
    translated = extract_json(text)
    # Safety: force original start/end to avoid drift
    for orig, tr in zip(es_segments, translated):
        tr['start'] = orig['start']
        tr['end'] = orig['end']
    return translated
