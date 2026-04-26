# Předčítač Českého Textu

Next.js frontend pro minimalistické čtení českého textu a lokální FastAPI backend pro progresivní OmniVoice voice-clone render.

## Požadavky

- Node.js 18+
- npm
- Python 3.11+
- lokálně připravené Python závislosti pro `tts-server/`

## Instalace

```bash
npm install
```

Backend používá vlastní Python prostředí. Pokud ještě není připravené, nainstaluj závislosti podle lokálního setupu pro OmniVoice/FastAPI.

Pro OmniVoice běh je v praxi potřeba alespoň:

```bash
python -m pip install "transformers==5.3.0" accelerate
```

ASR fallback pro `create_voice_clone_prompt(ref_audio=..., ref_text=None)` navíc vyžaduje funkční `torchcodec` + kompatibilní FFmpeg runtime. Na Windows to znamená mít dostupné FFmpeg DLL z "full-shared" buildu; bez toho render skončí chybou při načítání `libtorchcodec`.

## Transcript sidecar fallback

OmniVoice prompt creation teď používá tento pořadník:

1. najde vybraný hlasový `.wav`
2. zkusí načíst transcript sidecar se stejným stemem
3. pokud transcript existuje, použije `ref_audio + ref_text` a vůbec nespouští ASR
4. pokud transcript neexistuje, teprve potom použije ASR fallback
5. pokud ASR fallback selže, projekt/render skončí s jasnou backend chybou místo visení

Příklady sidecarů:

```text
tts-server/voices/speaker.wav
tts-server/voices/speaker.txt

tts-server/voices/my-voice.wav
tts-server/voices/my-voice.txt
```

Soubor `.txt` musí být prostý UTF-8 text. Prázdný transcript se bere jako chybějící.

Bundled demo voices `speaker.wav` až `speaker6.wav` teď mají připravené transcript sidecary, takže na tomto repu už nevyžadují ASR fallback pro voice-clone prompt.

## Spuštění ve vývoji

Preferovaný způsob:

```bash
node scripts/dev-up.mjs
```

Skript spustí backend na `8000` a frontend na prvním volném portu od `3000` výš, vypíše přesnou URL a ukončí oba procesy, pokud jeden z nich spadne.

Ruční spuštění:

1. Spusť TTS backend na portu `8000`:

```bash
cd tts-server
python server.py
```

2. Ve druhém terminálu spusť frontend:

```bash
npm run dev
```

Frontend v tomto repu teď běží přes Next.js dev server s Turbopackem.

3. Otevři aplikaci na URL, kterou frontend vypíše v terminálu.

Pokud backend neběží na `http://localhost:8000`, nastav před spuštěním frontendu:

```bash
NEXT_PUBLIC_TTS_API_BASE_URL=http://jiný-host:8000
```

Health endpoint backendu:

```text
http://localhost:8000/api/health
```

## Produkční build

```bash
npm run build
npm run start
```

## Ověření

- `npm run lint`
- `npm run test`
- `npm run build`

## Co umí aplikace

- vložit nebo upravit český text a uložit ho jako znovuotevíratelný projekt
- vybrat výchozí hlas, nahrát vlastní `.wav` a přiřadit různé hlasy jednotlivým blokům textu
- generovat bloky progresivně na pozadí a začít přehrávat hned po prvním připraveném bloku
- znovu použít uložené blokové audio bez nového renderu při stejném textu, hlasu a nastavení
- přehrávat, pauznout, obnovit, zastavit a stáhnout výsledný WAV s blokovým zvýrazněním textu

## Poznámky

- Frontend bez backendu naběhne, ale čtení zůstane nedostupné.
- Backend při prvním startu inicializuje OmniVoice runtime, takže start může trvat déle.
- První render může stáhnout OmniVoice/ASR modely z Hugging Face. Bez `HF_TOKEN` funguje i anonymní přístup, ale může být pomalejší.
- Vývojové logy se zapisují do `dev.log`, produkční start do `server.log`.
