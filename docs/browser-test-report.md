# Browser Test Report

Datum: 2026-04-14

## Cíl

Ověřit reálné chování aplikace v prohlížeči po spuštění lokálního frontendu a podle možností i backendu.

## Kroky

1. Spustit frontend.
2. Pokusit se spustit backend.
3. Otevřít aplikaci v prohlížeči.
4. Pořídit screenshoty výchozí obrazovky.
5. Ověřit dostupnost ovládání editoru, hlasu a přehrávání.
6. Zapsat skutečné chování a případné blokery.

## Screenshoty

- Výchozí stav: [browser-home.png](C:/Users/marti/Desktop/předčítač-českého-textu%20(1)/browser-home.png)
- Během přehrávání: [browser-playing.png](C:/Users/marti/Desktop/předčítač-českého-textu%20(1)/browser-playing.png)
- Pozastaveno: [browser-paused.png](C:/Users/marti/Desktop/předčítač-českého-textu%20(1)/browser-paused.png)
- Pokračování na dalším segmentu: [browser-resumed.png](C:/Users/marti/Desktop/předčítač-českého-textu%20(1)/browser-resumed.png)
- Po zastavení: [browser-stopped.png](C:/Users/marti/Desktop/předčítač-českého-textu%20(1)/browser-stopped.png)

## Výsledek

- Backend na `http://localhost:8000/api/health` odpovídal `200`.
- Frontend dev server nebyl v tomto prostředí stabilní, proto byl pro test použit produkční server z `.next/standalone` na `http://localhost:3000`.
- Aplikace se načetla korektně a zobrazila stav `Server online`.
- Editor textu fungoval, dlouhý testovací text šel vložit bez chyby.
- Kliknutí na `Přehrát` vytvořilo async job a UI přešlo do segmented playback view.
- Průběh ukazoval stav `1 / 6`, následně po obnově přehrávání `2 / 6` a `3 / 6`, takže navazování segmentů fungovalo.
- `Pozastavit` změnilo stav na `Pokračovat`.
- `Pokračovat` obnovilo přehrávání a zvýrazněný segment se posunul dál.
- `Zastavit` vrátilo aplikaci zpět do editoru s tlačítkem `Přehrát`.
- Jediná zachycená chyba v konzoli byla `404` pro `favicon.ico`, ne pro funkční část aplikace.

## Provedené kroky v browseru

1. Otevřena stránka `http://localhost:3000/`.
2. Zkontrolován výchozí stav UI a server status.
3. Pořízen screenshot výchozí obrazovky.
4. Do hlavního textarea pole vložen dlouhý testovací text pro long-form čtení.
5. Kliknuto na `Přehrát`.
6. Počkej 3 sekundy a zkontrolován přechod do segmented playback view.
7. Pořízen screenshot přehrávání s aktivním prvním segmentem.
8. Kliknuto na `Pozastavit`.
9. Ověřeno, že se CTA změnilo na `Pokračovat`.
10. Pořízen screenshot pozastaveného stavu.
11. Kliknuto na `Pokračovat`.
12. Počkej 2 sekundy a ověřen posun progressu na další segment.
13. Pořízen screenshot po obnovení přehrávání.
14. Kliknuto na `Zastavit`.
15. Ověřen návrat do editoru.
16. Pořízen screenshot finálního stavu po zastavení.
