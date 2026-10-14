# VERONIKILL — Zero resi

Shooter arcade top-down progettato per telefono (landscape) e browser desktop. Protagonista: Veronica. Una libreria immaginaria, **CartaMarcia**, è alla fine della strada.

## Stato

**Versione corrente v0.6**: shooter top-down completo del percorso da 25.000 unità, livello/XP e scelta dei potenziamenti al level-up, HUD compatta sui bordi e miglioramenti fino al livello 5. Arrivati alla libreria inizia la battaglia con il **Direttore Generale**: barra HP dedicata, raffiche, proiettili circolari, cariche telegrafate e fase furiosa. La vittoria segue soltanto alla sconfitta del boss e alla sequenza libreria intatta → danneggiata → in fiamme.

**Da aggiungere**: sprite illustrato specifico del Direttore (attualmente usa lo sprite del Capo reparto, ingrandito e con aura), boomerang, effetti sonori e musica, playtesting/bilanciamento approfondito.

## Avviare in locale

Richiede Node.js 22+.

```bash
npm install
npm run dev
```

Controllo qualità/build:

```bash
npm run build
npm run preview
```

## Controlli

- **Telefono**: ruotare in orizzontale; joystick sinistro = movimento, destro = mira. Il mitra spara automaticamente verso l'ultima direzione di mira.
- **Desktop**: WASD o frecce per muoversi; mouse per mirare. Space / Esc per pausa.
- Nessun pulsante di sparo. I pickup si raccolgono per contatto.

## Pubblicazione GitHub Pages

Il progetto usa **Vite** con `base: '/Veronikill/'` e **vite-plugin-pwa**. L'Action in `.github/workflows/deploy.yml` crea la build e la carica su GitHub Pages.

1. Apri **Settings → Pages** nel repo.
2. Alla voce **Build and deployment → Source** seleziona **GitHub Actions**.
3. Apri **Actions**, controlla che **Deploy Veronikill PWA** sia verde, o lanciala con **Run workflow**.
4. Apri **https://ilboccia94.github.io/Veronikill/**.
5. In Chrome Android apri il menu del browser e scegli **Installa app** (se disponibile); in Safari iOS usa **Condividi → Aggiungi alla schermata Home**.

La PWA usa un service worker per conservare la shell e gli asset statici dopo il primo caricamento online. Verificare manualmente offline e installazione su telefono.

## Architettura

- `src/main.ts`: bootstrap Phaser, componenti UI e controlli.
- `src/game/GameScene.ts`: simulazione di gioco, gestione nemici/armi e mondo.
- `src/styles.css`: UI responsiva e joystick.
- `public/icon.svg`: icona vettoriale provvisoria; lo script `scripts/make-icons.mjs` genera PNG 192/512 maskable senza dipendenze prima di dev/build.
- `vite.config.ts`: PWA, cache offline e base path di GitHub Pages.

Il marchio CartaMarcia è inventato. La violenza è esclusivamente slapstick/cartoon senza gore.

## Artwork ufficiale integrato (ottobre 2026)

Gli asset grafici approvati sono ora caricati nel repository, nella cartella `public/`:

- `icon-192.png` e `icon-512.png`: nuove icone PWA installabili (logo Veronikill)
- `logo.webp`: logo e artwork della schermata iniziale
- `veronica-hero.webp`: illustrazione di Veronica per il menu
- `veronica-topdown.webp`: sprite di Veronica in partita

Lo sprite viene caricato da Phaser durante `preload()` e sostituisce la sagoma provvisoria; il fallback grafico è mantenuto solo se un caricamento fallisce. La build conserva i PNG ufficiali senza sovrascriverli e include WebP nella cache offline PWA. La risoluzione degli asset è stata ottimizzata per la distribuzione mobile senza modificare le illustrazioni scelte.

**Nota**: le pose in movimento non costituiscono ancora un'animazione frame-by-frame. Per la prossima milestone prevedere sprite sheet animata dedicata.

## Grafica v0.2 — strada, nemici, oggetti e libreria Giunti

Il gioco carica le grafiche reali da `public/assets/` in formato WebP:
`street/street-segment.webp`, `enemies/{commesso,capo,cliente}.webp`,
`items/{mitra,missile,lame,cura,scudo,caffe,munizioni}.webp` e
`bookstore/{giunti,giunti-damaged,giunti-fire}.webp`.

La strada è più alta (mondo 900 px), la telecamera segue Veronica anche in verticale
e i nemici/oggetti ora utilizzano gli sprite illustrati.
Sono attivi i pickup scudo temporaneo, caffè per la velocità e munizioni per la raffica.
La libreria Giunti è visibile al traguardo; le versioni danneggiata e in fiamme
sono risorse predisposte per la futura boss fight, non ancora una boss fight giocabile.

Il contenuto è una parodia videoludica e non è affiliato ad alcuna libreria o marchio.


## Progressione v0.3 — esperienza e level-up

- Percorso portato a **25.000 unità** (da 7.600), sempre verso la libreria Giunti.
- Ogni eliminazione assegna XP automaticamente: **commesso +10, cliente +14, capo reparto +24**.
- Al raggiungimento della soglia esperienza, il gioco si sospende e mostra **3 potenziamenti casuali e distinti** (telefono: tocca una carta; desktop: premi 1/2/3).
- Le opzioni comprendono missili a ricerca, lame orbitanti, danno mitra, cadenza di fuoco, velocità, salute massima, riduzione danni e guarigione.
- Le migliorie permanenti valgono per la run corrente. I pickup sulla strada restano disponibili.
- Le soglie XP aumentano con il livello e l'XP in eccesso viene conservata.
- La difficoltà cresce gradualmente lungo il percorso; la boss fight resta una milestone successiva.


## Graphics update v0.4 — Street & Giunti

- The level now uses the supplied wide top-down road art, converted into a horizontally seamless scrolling WebP texture at `public/assets/street/street-segment.webp` (1920×900).
- The source modular road tileset is also saved as `public/assets/street/street-tiles-v2.webp` for future variations.
- The destination now uses the approved **blue-and-white Giunti branding**. Transparent sprites, cut out from the updated source art, live at:
  - `public/assets/bookstore/giunti.webp`
  - `public/assets/bookstore/giunti-damaged.webp`
  - `public/assets/bookstore/giunti-fire.webp`
- The original updated graphics atlas is retained at `public/assets/bookstore/giunti-atlas-v2.webp`.
- The game preserves the 25,000-unit extended route and vertical camera movement; only background/store graphics changed in this update.
- The alternate store states are loaded and ready for future encounter sequences; the game currently displays the intact storefront at the finish line.


## Graphics refresh — modular street & Giunti illustrated atlas

- A new clean 2000 × 900 scrolling street, assembled from the latest modular road sheet, replaces the prior road graphic in `public/assets/street/street-segment.webp`.
- The full modular source sheet is saved at `public/assets/street/street-tileset.webp`.
- The new blue-and-white Giunti art is split into three transparent, individually usable in-game sprites: `giunti.webp`, `giunti-damaged.webp`, and `giunti-fire.webp` inside `public/assets/bookstore/`.
- Its complete reference atlas is saved as `public/assets/bookstore/giunti-atlas.webp`.
- The playable zone is aligned to the road asphalt boundaries while maintaining the vertical-follow camera and XP system.
- The current destination shows the intact storefront; damaged/fire sprites are loaded for the upcoming final encounter.

## Boss fight v0.5 — Direttore Generale

- La battaglia parte quando Veronica raggiunge gli ultimi **560 px** di avanzamento; non esiste più una vittoria automatica attraversando la linea di arrivo.
- Il Direttore usa una barra vita dedicata e ha tre pattern: **raffiche a ventaglio**, **ondate circolari** e **carica annunciata da una linea rossa**.
- Sotto il 45% della salute accelera gli attacchi ed entra in modalità furiosa. La vita massima scala leggermente con il livello della giocatrice.
- Il boss è bersaglio dei proiettili, dei missili a ricerca e delle lame orbitanti. Gli altri nemici vengono rimossi dall'arena per mantenere la visuale leggibile su telefono.
- Dopo la sconfitta: sprite della libreria **`giunti-damaged-v04.webp`** per 1,55 secondi, poi **`giunti-fire-v04.webp`** con fiamme cartoon per 3,2 secondi; infine compare la schermata di vittoria.
- La telecamera inquadra la libreria durante il finale; **Riprova** ripristina l'edificio e il normale inseguimento della protagonista.
- Per vedere le modifiche pubblicate, attendere il completamento della GitHub Action **Deploy Veronikill PWA** e, se necessario, ricaricare la PWA per aggiornare la cache.

## HUD e potenziamenti v0.6 — leggibilità mobile

- HUD riposizionata sui bordi: salute e XP in alto a sinistra, punteggio/pausa in alto a destra, progressione (oppure barra del boss) nell'area **centrale in alto**. Le scritte di boss e pickup ora appaiono come brevi notifiche nell'angolo, mentre gli XP si vedono sulla barra senza pop-up di uccisione.
- Le armi e le statistiche sbloccate compaiono in badge compatti lungo il **bordo inferiore**, tra i joystick. Badge **MAX** quando la relativa abilità arriva al livello 5.
- **Massimo livello 5** per missili, lame, cadenza di fuoco, movimento, difesa, vita massima (5 step da +20 HP), e mitra (iniziando dal livello 1: quattro aumenti del danno). I potenziamenti permanenti a livello massimo non compaiono più fra le scelte.
- I pickup di **missili e lame**, quando la rispettiva arma raggiunge il massimo, non vengono più generati e quelli già a terra vengono rimossi. Le posizioni successive generano altri tipi di pickup: cura, scudo, caffè o munizioni.
- La cura al level-up rimane riutilizzabile, perché non è un miglioramento permanente con livello. Se non esistono più opzioni disponibili, un level-up non apre un pannello vuoto.
- Lo stato della PWA e la resa della HUD vanno verificati su un telefono in orizzontale dopo il deploy.

## V0.7 — Area di gioco a piena larghezza e cache sprite

- Il canvas Phaser usa `Scale.RESIZE` al posto di `Scale.FIT`, quindi occupa tutta l'area viewport disponibile anche su telefoni più larghi del 16:9. La telecamera mantiene l'altezza di mondo a 900 unità e mostra più mondo in orizzontale, senza deformare gli sprite.
- Giocando su browser Android, il pulsante Avvia prova anche a entrare in fullscreen tramite gesto dell'utente (best effort). La manifest della PWA installata richiede fullscreen, dove supportato dal sistema operativo; eventuali barre di sistema restano soggette ad Android.
- Nuove URL versionate `enemies/commesso-v2.webp` e `enemies/capo-v2.webp`, per evitare il riuso delle immagini precedenti nella cache dell'app installata. Il Direttore mantiene il suo asset indipendente `enemies/direttore.webp`.
- Messaggio di versione V0.7 nella schermata iniziale e nella HUD per riconoscere un'installazione aggiornata. Se il Service Worker si aggiorna durante una partita, il refresh viene differito.


## v0.8 — Zoom della telecamera e libri-proiettile

- Il canvas resta fullscreen responsivo (niente bande laterali), ma la telecamera mostra circa **560 unità** verticali sulle 900 del mondo invece dell'intera mappa. Personaggi e pickup appaiono circa **1,6× più grandi** a parità di dimensione schermo.
- La telecamera segue Veronica in **orizzontale e verticale**, rispettando sempre i confini del mondo e adattandosi al ridimensionamento del viewport.
- I clienti pazzi ora lanciano **libri blu rotanti** (sprite Phaser disegnato a codice). I proiettili degli altri nemici e del Direttore rimangono invariati.
