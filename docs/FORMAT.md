# Austauschformat für Rezepte

Damit lassen sich viele Rezepte auf einmal in „Unsere Küche“ übernehmen: in der App unter
**Mehr → Import & Export → Rezepte aus Datei importieren** oder unter **Rezepte → Importieren → Datei**.
Die App zeigt vor dem Übernehmen, was neu ist, was es schon gibt und was nicht passt.

Eine fertige Vorlage liegt daneben: [`rezepte-vorlage.json`](rezepte-vorlage.json).
Ein Export aus der App hat dasselbe Format und lässt sich wieder importieren.

## Aufbau

```json
{
  "format": "rezepte-app/rezepte",
  "version": 1,
  "rezepte": [
    {
      "title": "Pfannkuchen",
      "ingredients": ["Für den Teig:", "250 g Mehl", "500 ml Milch", "3 Eier"],
      "steps": ["Alles glatt rühren.", "Portionsweise ausbacken."]
    }
  ]
}
```

Die App nimmt auch eine nackte Liste `[ {…}, {…} ]` oder ein einzelnes Rezept `{ "title": … }`.

## Felder

| Feld (englisch / deutsch) | Pflicht | Inhalt |
| --- | --- | --- |
| `title` / `titel` | ja | Name des Rezepts |
| `ingredients` / `zutaten` | ja¹ | Liste von Textzeilen wie `"250 g Mehl, gesiebt"` – oder ein Text mit Zeilenumbrüchen. `"Für den Teig:"` (Doppelpunkt am Ende) beginnt einen Abschnitt, ein leerer Eintrag `""` beendet ihn. |
| `steps` / `zubereitung` | ja¹ | Liste von Schritten oder ein Text; Nummern wie „1.“ werden entfernt |
| `servings` / `portionen` | | Zahl oder „4 Portionen“ (ohne Angabe: 4) |
| `prepMin` / `vorbereitung` | | Minuten oder „1 Std. 20 Min.“ |
| `cookMin` / `kochzeit`, `backzeit` | | Minuten oder „45 Min.“ |
| `categories` / `kategorien` | | Liste oder „Hauptgericht, Suppe“ – fehlende werden angelegt |
| `tags` | | z. B. „vegetarisch, glutenfrei“ – fehlende werden angelegt |
| `description` / `beschreibung` | | ein Satz |
| `source` / `quelle` | | Buch mit Seite, Webseite, Account |
| `notes` / `notizen` | | Text oder Liste – werden zu Notizen im Rezept |
| `tips` / `tipps` | | Tipps aus dem Original – Notiz „aus dem Original“ |
| `rating` / `bewertung` | | 0–5 |
| `favorite` / `favorit` | | `true` / `false` |

¹ Zutaten **oder** Zubereitung muss vorhanden sein.

**Zutaten schreiben:** Menge zuerst, dann Einheit, dann Zutat, Hinweise nach einem Komma:
`2 EL Olivenöl`, `1 Dose Tomaten (400 g)`, `½ Bund Petersilie`, `2-3 Zehen Knoblauch`, `Salz`.
Bekannte Einheiten: g, kg, ml, l, EL, TL, Prise, Msp, Stück, Bund, Dose, Becher, Glas, Packung,
Päckchen, Zehe, Scheibe, Tasse, Handvoll, Zweig, Würfel, Blatt, Kopf, Stange, Knolle, Schuss.

**Fotos** werden nicht über Dateien übernommen.

## Doppelte Rezepte

Gleicher Titel (Groß-/Kleinschreibung egal) = gleiches Rezept. Beim Import wählt man:
**Überspringen** · **Aktualisieren** (Zutaten, Schritte, Angaben werden ersetzt, eure Notizen bleiben) ·
**Als Kopie** (z. B. „Pfannkuchen (2)“).

## Zu Hause mit Claude vorbereiten

Fotos, PDFs oder Links in einen Ordner legen und Claude bitten:
„Wandle alle Rezepte in diesem Ordner in eine Datei im Format aus `docs/FORMAT.md` um.
Was du nicht lesen kannst, nimm nicht auf und liste es mir auf.“
