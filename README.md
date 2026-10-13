# VERONIKILL — Zero resi

Shooter arcade top-down progettato per telefono (landscape) e browser desktop. Protagonista: Veronica. Una libreria immaginaria, **CartaMarcia**, è alla fine della strada.

## Stato

**Prototipo giocabile v0.1**: strada urbana generata a segmenti, movimento e mira indipendenti, fuoco automatico, tre archetipi di nemici, proiettili ostili, missile a ricerca, lame orbitanti, pickup, HUD, progressione fino alla libreria, sconfitta/vittoria e retry.

**Non ancora incluso**: boss Proprietario, incendio cartoon, boomerang, audio, asset grafici definitivi, salvataggi/high score, bilanciamento. Questi sono milestone successive, non funzionalità già realizzate.

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

## Artwork ufficiale

La schermata iniziale è pronta a utilizzare `public/logo.png` e `public/veronica-hero.png`. Se le immagini non sono presenti, mostra i titoli e l'UI esistenti senza errori bloccanti. Il generatore PWA in `scripts/make-icons.mjs` ora mantiene eventuali PNG personalizzati `public/icon-192.png` e `public/icon-512.png` senza sovrascriverli durante la build. Finché questi asset non sono caricati nel repository, il gioco continuerà a mostrare le grafiche provvisorie.
