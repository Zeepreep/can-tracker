// Tiny i18n: English strings are the keys; Dutch lives in NL below. Missing keys fall back to English.
export type Lang = 'en' | 'nl';

let lang: Lang = (() => {
  try { const s = localStorage.getItem('lang'); if (s === 'en' || s === 'nl') return s; } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && /^nl\b/i.test(navigator.language || '') ? 'nl' : 'en';
})();

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  window.dispatchEvent(new Event('lang-changed'));
}

export function t(key: string, params?: Record<string, string | number>): string {
  let s = (lang === 'nl' && NL[key]) || key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

/** "1 can" / "5 cans" */
export const cansLabel = (n: number) => (n === 1 ? t('1 can') : t('{n} cans', { n }));

const loc = () => (lang === 'nl' ? 'nl-NL' : 'en-GB');
export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(loc());
export const fmtDateTime = (ms: number) => new Date(ms).toLocaleString(loc());

/** Translate the static bits of index.html. */
export function applyStatic() {
  document.documentElement.lang = lang;
  const tabs: Record<string, string> = { scan: 'Scan', collection: 'Collection', wants: 'Wants', more: 'More' };
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => { b.textContent = t(tabs[b.dataset.tab ?? ''] ?? ''); });
  const bar = document.getElementById('update-message'); if (bar) bar.textContent = t('Update available');
  const btn = document.getElementById('update-btn'); if (btn) btn.textContent = t('Reload');
}

export const NL: Record<string, string> = {
  // tabs / shell
  'Scan': 'Scannen', 'Collection': 'Collectie', 'Wants': 'Zoeklijst', 'More': 'Meer',
  'Update available': 'Update beschikbaar', 'Update ready': 'Update beschikbaar', 'Reload': 'Herladen',
  'App update': 'App-update', 'Version {version}': 'Versie {version}', 'Check for updates': 'Controleren op updates',
  'Check whether a newer version is available.': 'Controleer of er een nieuwere versie beschikbaar is.',
  'Checking for updates…': 'Controleren op updates…', 'Update ready. Tap Reload at the top of the screen.': 'Update klaar. Tik bovenaan op Herladen.',
  'A new version was found and is downloading. The update button will appear when it is ready.': 'Een nieuwe versie is gevonden en wordt gedownload. De updateknop verschijnt zodra deze klaar is.',
  'You are using the latest version.': 'Je gebruikt de nieuwste versie.',
  'Automatic updates are not supported by this browser.': 'Automatische updates worden niet ondersteund door deze browser.',
  'Could not check for updates. Check your internet connection and try again.': 'Controleren op updates is niet gelukt. Controleer je internetverbinding en probeer het opnieuw.',
  // form
  'Edit can': 'Blikje bewerken', 'Add can': 'Blikje toevoegen', 'Name': 'Naam', 'Flavor': 'Smaak',
  'Tagline on can': 'Tekst op het blikje', 'Country / language': 'Land / taal', 'Barcode': 'Barcode', 'Notes': 'Notities',
  'e.g. Kaktusfeige / cactus fruit': 'bijv. Kaktusfeige / cactusvijg', 'Germany': 'Duitsland',
  'Have it': 'Heb ik', 'Want it': 'Wil ik', 'Save': 'Opslaan', 'Cancel': 'Annuleren', 'Delete': 'Verwijderen',
  'Please enter a name.': 'Vul een naam in.',
  'That barcode number does not look right. Check the digits or clear the field.': 'Dit barcodenummer klopt niet. Controleer de cijfers of maak het veld leeg.',
  '"{name}" already has this barcode. Save anyway?': '"{name}" heeft al deze barcode. Toch opslaan?',
  'Could not save. Storage may be full or blocked.': 'Opslaan mislukt. De opslag is mogelijk vol of geblokkeerd.',
  'Delete this can?': 'Dit blikje verwijderen?', 'Deleted': 'Verwijderd', 'Undo': 'Ongedaan maken',
  // list
  'Search flavor, tagline, country…': 'Zoek op smaak, tekst, land…', '{a} of {b}': '{a} van {b}',
  'No cans match that search.': 'Geen blikjes gevonden voor deze zoekopdracht.',
  'No cans yet. Tap + or use Scan.': 'Nog geen blikjes. Tik op + of gebruik Scannen.',
  'Nothing on your wants list. Tap + to add a can you saw online.': 'Je zoeklijst is leeg. Tik op + om een blikje toe te voegen dat je online zag.',
  'Found it': 'Gevonden', 'Moved to your collection': 'Verplaatst naar je collectie',
  // scan
  'Stop camera': 'Camera stoppen', 'Scan with camera': 'Scannen met camera',
  'Take or pick a photo of the barcode': 'Maak of kies een foto van de barcode',
  "Can't scan it? Photograph the front instead": 'Lukt scannen niet? Fotografeer de voorkant',
  'Or type the barcode digits': 'Of typ de cijfers van de barcode', 'Look up': 'Opzoeken',
  'Try the front of the can instead': 'Probeer de voorkant van het blikje',
  'You already have this one ✓': 'Dit blikje heb je al ✓', 'On your wants list': 'Staat op je zoeklijst',
  'Found it! Add to collection': 'Gevonden! Toevoegen aan collectie', 'Added to your collection': 'Toegevoegd aan je collectie',
  'New barcode. Looking it up…': 'Nieuwe barcode. Wordt opgezocht…',
  'Found on Open Food Facts. Check the name and fill in the flavor.': 'Gevonden in Open Food Facts. Controleer de naam en vul de smaak in.',
  'Not in Open Food Facts. Fill it in yourself.': 'Niet in Open Food Facts. Vul het zelf in.',
  'Lookup is busy right now. Fill it in yourself.': 'Opzoeken is nu druk. Vul het zelf in.',
  'No internet lookup right now. Fill it in yourself.': 'Nu geen internetopzoeking mogelijk. Vul het zelf in.',
  'Barcode {code}': 'Barcode {code}', 'Add this can': 'Dit blikje toevoegen',
  'That number does not look right. Check each digit (8 or 13 digits).': 'Dit nummer klopt niet. Controleer elk cijfer (8 of 13 cijfers).',
  'Reading barcode…': 'Barcode lezen…',
  'No barcode found in that photo. Try closer, flatter and with more light, or type the digits.': 'Geen barcode gevonden op die foto. Probeer dichterbij, rechter en met meer licht, of typ de cijfers.',
  'Could not read that photo. Type the digits instead.': 'Die foto kon niet worden gelezen. Typ de cijfers.',
  'Starting camera… hold the barcode inside the box.': 'Camera starten… houd de barcode in het kader.',
  'Camera permission was denied. You can type the number or take a photo instead.': 'Cameratoegang is geweigerd. Je kunt het nummer typen of een foto maken.',
  'Camera not available. You can type the number or take a photo instead.': 'Camera niet beschikbaar. Je kunt het nummer typen of een foto maken.',
  'Camera could not start. Use photo or type the number.': 'Camera kon niet starten. Gebruik een foto of typ het nummer.',
  // front-of-can
  'Reading the can… the first time takes a little longer.': 'Blikje lezen… de eerste keer duurt iets langer.',
  'Loading the text reader (first time only)…': 'Tekstlezer laden (alleen de eerste keer)…', 'Reading the text…': 'Tekst lezen…',
  'I read: ': 'Gelezen: ',
  'Recognized product text: ': 'Herkende producttekst: ',
  'No reliable product words matched your collection. Try a closer, straighter photo of the can.': 'Geen betrouwbare productwoorden uit je collectie herkend. Probeer een foto dichterbij en rechter van het blikje.',
  'Tagline language: {language}': 'Taglinetaal: {language}',
  'Possible markets: {countries}': 'Mogelijke markten: {countries}',
  'This tagline does not identify a country.': 'Deze tekst identificeert geen specifiek land.',
  'I could not read any text. Try again with the label facing the camera and good light.': 'Ik kon geen tekst lezen. Probeer opnieuw met het etiket naar de camera en goed licht.',
  'Looks like this one:': 'Lijkt op dit blikje:', 'Could it be one of these?': 'Is het misschien een van deze?',
  'Not in your list yet.': 'Nog niet in je lijst.', 'In your collection': 'In je collectie', 'Yes': 'Ja',
  'None of these: add as a new can': 'Geen van deze: toevoegen als nieuw blikje', 'Add as a new can': 'Toevoegen als nieuw blikje',
  'Could not read the can on this phone. You can still add it by hand.': 'Het blikje kon op deze telefoon niet worden gelezen. Je kunt het nog met de hand toevoegen.',
  'Add a can by hand': 'Blikje met de hand toevoegen',
  // origin (language / country guess)
  'English': 'Engels', 'Czech': 'Tsjechisch', 'Swedish': 'Zweeds', 'Portuguese': 'Portugees', 'Can Tracker': 'Can Tracker', 'Dutch': 'Nederlands', 'German': 'Duits', 'Polish': 'Pools', 'French': 'Frans', 'Spanish': 'Spaans', 'Italian': 'Italiaans',
  'Netherlands': 'Nederland', 'Belgium': 'België', 'Austria': 'Oostenrijk', 'Switzerland': 'Zwitserland', 'Poland': 'Polen', 'France': 'Frankrijk', 'Spain': 'Spanje', 'Italy': 'Italië', 'Czechia': 'Tsjechië', 'Sweden': 'Zweden', 'Portugal': 'Portugal', 'Brazil': 'Brazilië', 'Canada': 'Canada', 'Slovakia': 'Slowakije',
  'Tagline known from "{name}": {country}': 'Tekst bekend van "{name}": {country}',
  'Language read: {lang}. Possible country: {countries}': 'Taal herkend: {lang}. Mogelijk land: {countries}',
  'Language read: {lang}. English says nothing about the country.': 'Taal herkend: {lang}. Engels zegt niets over het land.',
  // tagline library
  'Tagline library': 'Tagline-bibliotheek',
  'Look up which language and country a text on a can belongs to, without scanning.': 'Zoek bij welke taal en welk land een tekst op een blikje hoort, zonder te scannen.',
  'Open library': 'Bibliotheek openen', 'Close': 'Sluiten',
  'Type what is printed on the can': 'Typ wat er op het blikje staat',
  'Only wording I saw on the official Red Bull websites is listed. Cans from other countries may differ.': 'Alleen teksten die ik op de officiële Red Bull-websites heb gezien staan hier. Blikjes uit andere landen kunnen afwijken.',
  'No match. The text may be new, or use a different spelling.': 'Geen match. De tekst is misschien nieuw of anders gespeld.',
  'Wings slogan': 'Vleugels-slogan', 'Body and mind line': 'Tekst over lichaam en geest', 'Seen on: {sites}': 'Gezien op: {sites}',
  // more
  'Language': 'Taal', 'Backup': 'Back-up', '1 can': '1 blikje', '{n} cans': '{n} blikjes', '{count} stored on this phone.': '{count} opgeslagen op deze telefoon.',
  'Last backup: {date}': 'Laatste back-up: {date}', 'No backup made yet.': 'Nog geen back-up gemaakt.',
  'Save backup file': 'Back-upbestand opslaan', 'Restore from backup file': 'Herstellen uit back-upbestand',
  'Undo last restore ({count} from {date})': 'Laatste herstel ongedaan maken ({count} van {date})',
  'Sync (optional)': 'Synchroniseren (optioneel)', 'Connected to {repo}': 'Verbonden met {repo}',
  '. Last sync {date}': '. Laatst gesynchroniseerd {date}',
  'Keeps a copy of the collection in your private GitHub data repo.': 'Bewaart een kopie van de collectie in je privé GitHub-datarepo.',
  'GitHub user': 'GitHub-gebruiker', 'Data repo': 'Datarepo', 'Access token': 'Toegangstoken',
  'Save and sync now': 'Opslaan en nu synchroniseren', 'Connect and sync': 'Verbinden en synchroniseren',
  'Disconnect': 'Verbinding verbreken', 'Syncing…': 'Synchroniseren…', 'Preview': 'Voorbeeld',
  '{a} new, {b} updated, {c} unchanged': '{a} nieuw, {b} bijgewerkt, {c} ongewijzigd',
  ', {n} unreadable skipped': ', {n} onleesbaar overgeslagen',
  'Nothing is deleted. You can undo afterwards.': 'Er wordt niets verwijderd. Je kunt het achteraf ongedaan maken.',
  'Apply': 'Toepassen',
  'Go back to how your collection was before the last restore?': 'Teruggaan naar je collectie van vóór het laatste herstel?',
  // self-check (report text itself stays English so it can be sent to the developer)
  'Self-check': 'Zelftest', 'Running…': 'Bezig…', 'Run again': 'Opnieuw uitvoeren', 'Copy report': 'Rapport kopiëren', 'Report': 'Rapport',
  // backup / sync messages
  'That file is not a valid backup (could not read it).': 'Dit bestand is geen geldige back-up (kon het niet lezen).',
  'That file is not a Can Tracker backup.': 'Dit bestand is geen Can Tracker-back-up.',
  'This backup is from a newer version of the app. Update the app first.': 'Deze back-up komt van een nieuwere versie van de app. Werk de app eerst bij.',
  'Sync is not set up.': 'Synchroniseren is niet ingesteld.',
  'GitHub rejected the token. It may have expired or lacks access to the data repo.': 'GitHub weigert het token. Het is mogelijk verlopen of heeft geen toegang tot de datarepo.',
  'Data repo not found. Check owner/name and token access.': 'Datarepo niet gevonden. Controleer gebruiker/naam en tokentoegang.',
  'GitHub rejected the token.': 'GitHub weigert het token.',
  'The data file is too large for sync.': 'Het databestand is te groot om te synchroniseren.',
  'The file in the data repo is not valid. Nothing was changed.': 'Het bestand in de datarepo is ongeldig. Er is niets gewijzigd.',
  'GitHub answered {s}.': 'GitHub antwoordde {s}.',
  'Token can read but not write. It needs "Contents: Read and write".': 'Het token kan lezen maar niet schrijven. Het heeft "Contents: Read and write" nodig.',
  'GitHub answered {s} on save.': 'GitHub antwoordde {s} bij het opslaan.',
  'Could not save after several tries. Try again in a moment.': 'Opslaan lukte niet na meerdere pogingen. Probeer het zo opnieuw.',
  'No connection to GitHub. Your data is safe on this phone.': 'Geen verbinding met GitHub. Je gegevens staan veilig op deze telefoon.',
};
