# Civicor

Pianifica le consegne dal telefono: scansioni le etichette, ottimizzi il giro, consegni fermata per fermata.
Gratis, senza account, con i dati solo sul tuo telefono.

## Cosa fa

- **Scansione delle etichette GLS**: legge il codice Data Matrix (il quadratino) e compila da sola via, civico,
  CAP e note del mittente. Il civico non viene mai letto male.
- **Verifica degli indirizzi**: se la mappa non conosce un civico, te lo mostra prima di partire. Sposti il punto
  col dito e Civicor se lo ricorda per le volte successive.
- **Ottimizzazione** di 130+ fermate, con fermate da fare per prime o per ultime, fasce orarie e sosta.
- **Guida**: Naviga con Waze, Google Maps o Apple Maps; Effettuata / Non riuscita con Annulla.
- Inserimento anche a mano, a voce, incollando una lista o scegliendo il punto sulla mappa.

## Prima di iniziare: la chiave gratuita di OpenRouteService

Civicor usa OpenRouteService (basato su OpenStreetMap) per trovare gli indirizzi e calcolare le distanze.

1. Registrati gratis su [openrouteservice.org](https://openrouteservice.org/dev/#/signup).
2. Nella tua dashboard crea una chiave (piano gratuito "Standard").
3. In Civicor apri **Menu → Impostazioni → Chiave OpenRouteService** e incollala.

La chiave resta solo sul telefono e non finisce nei backup. Il piano gratuito basta per un autista
(circa 6 richieste di distanze per ottimizzare 130 fermate, su 500 al giorno).

## Facoltativo: civici più precisi con Google

OpenStreetMap conosce pochi numeri civici in alcune zone. Per la precisione di Google Maps:
**Impostazioni → Ricerca indirizzi → Google** e incolla una chiave Google Maps Platform con
**Places API (New)** e **Geocoding API** attive, limitata al sito di Civicor. Google offre 10.000 richieste
gratuite al mese per ciascun servizio. Anche questa chiave resta solo sul telefono.
Le distanze per ottimizzare il percorso continuano a usare OpenRouteService.

## Installare l'app sull'iPhone

1. Apri l'indirizzo dell'app in **Safari**.
2. Tocca **Condividi → Aggiungi alla schermata Home**.
3. Apri Civicor dall'icona e consenti l'accesso alla fotocamera quando scansioni la prima etichetta.

## Backup

**Impostazioni → Esporta backup** salva un file con percorsi, tipi di fermata e soprattutto le posizioni corrette.
Conservalo su iCloud Drive: se cambi telefono, **Importa backup** lo ripristina.

## Sviluppo

```bash
npm install
npm test          # test automatici
npm run dev       # HTTPS sulla rete locale, per provare la fotocamera dall'iPhone
npm run build     # versione di produzione in dist/
```

Per provare dall'iPhone: avvia `npm run dev`, apri `https://<ip-del-mac>:5173` in Safari e accetta il certificato.

Struttura: `src/domain` (logica pura), `src/services` (OpenRouteService, coda indirizzi, ottimizzazione),
`src/data` (IndexedDB), `src/device` (fotocamera, voce, suoni), `src/ui` (schermate).
