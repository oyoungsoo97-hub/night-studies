# Night Studies · After Hours

[English](README.md) · [한국어](README.ko.md) · [Deutsch](README.de.md)

[Night Studies auf Deutsch öffnen](https://oyoungsoo97-hub.github.io/night-studies/?lang=de)

Zwei Kamerabühnen und drei Werkstätten für Plakate, Geräusche und Fotografie. Die Sprache lässt sich während der Arbeit wechseln. Selbst geschriebene Titel, Bildunterschriften und Dateinamen bleiben erhalten.

| Bühne oder Werkstatt | Was du gestalten kannst |
| --- | --- |
| [Astral Atelier](https://oyoungsoo97-hub.github.io/night-studies/spell-stage/?lang=de) | Sammle Silberstaub in einer Hand, ziehe die Wolke zwischen deinen Händen auseinander und verstreue sie. Mit dem Zauberstab kannst du Glut gegen den Glasschild schleudern. |
| [Portrait Loom](https://oyoungsoo97-hub.github.io/night-studies/portrait-stage/?lang=de) | Erzeuge aus deinem Foto eine texturierte 3D-Figur. Drehe sie, setze das Licht, spiele mit der Kamera und exportiere die aktuelle Pose als GLB-Modell. |
| [Last Train](https://oyoungsoo97-hub.github.io/night-studies/last-train/?edition=house&lang=de) | Gestalte ein Filmplakat aus deinem Foto, einer Druckvorlage, einer Papierkante und einem Standbild des fahrenden Zugs. Exportiere es als PNG. |
| [Foley Club](https://oyoungsoo97-hub.github.io/night-studies/foley-club/?edition=house&lang=de) | Vertone einen Film in zwei Takes. Bearbeite Einsatzzeit, Lautstärke und Stereoposition und exportiere die Tonspur als Stereo-WAV mit 48 kHz. Eigene MP4- und WebM-Clips dürfen bis zu 60 Sekunden lang und 12 MiB groß sein. |
| [Light Table](https://oyoungsoo97-hub.github.io/night-studies/light-table/?edition=house&lang=de) | Importiere bis zu fünf Fotos. Wähle drei Ausschnitte und ihre Bildunterschriften, gestalte den Abzug und speichere ihn als PNG oder JPEG. |

### Spielen und Speichern

Die Winter-Studie verbindet sechs Standbilder von TV10 mit einer Gehsequenz. **Vorne**, **Profil** und **Hinten** zeigen die Figur aus drei Richtungen. Eine direkte Rückansicht diente als Vorlage für Frisur und Hemdschnitt. Die Textur in der Rückenmitte, Teile des Hinterkopfs und die Hand außerhalb des Bildes wurden modelliert. Mit **Rückansicht einpassen** kannst du ein eigenes Foto vom Scheitel bis zum Nacken ausrichten und im Projekt speichern.

Portrait Loom öffnet JPEG, PNG, WebP, GIF, BMP und AVIF. Für HEIC benötigt der Browser einen passenden Decoder. Bei animierten GIFs wird das erste Bild verwendet.

Wähle eine Person im Gruppenfoto oder markiere bei einer Zeichnung Augen und Mund. Ziehe an der 3D-Figur oder drehe sie mit dem Regler. Wechsle das Licht, um Nase, Kinn und Finger im Profil zu sehen. Sichtbare Flächen erhalten die Textur des Fotos. Form und Material verdeckter Seiten werden aus diesem einen Blickwinkel geschätzt. **3D-Modell speichern** exportiert die aktuelle Pose mit Texturen als GLB. Mit **Projekt speichern** bleibt der Auftritt bearbeitbar.

Beide Bühnen speichern PNGs und in Browsern mit Videoaufnahme bis zu zwölf Sekunden Film. Astral Atelier nimmt den sichtbaren Hintergrund mit auf. Schalte vor der Aufnahme den Zauberklang ein, um die synthetisierte Stereospur zu speichern. Für die Bewegungsverfolgung wird nur das Kamerabild verwendet.

Mit **Projekt speichern** landet deine Arbeit im Projektarchiv dieses Browsers. Für einen Gerätewechsel wählst du **Verwalten → Datei exportieren** und im neuen Browser **Datei importieren**. Die `.nightstudy`-Datei enthält importierte Medien und Einstellungen. Kamerabilder, importierte Fotos und Bewegungspunkte von Gesicht, Händen und Körper werden auf deinem Gerät verarbeitet.

### Lokal starten

Entpacke die ZIP-Datei. Öffne unter macOS **Start.command** oder führe mit Python 3 im entpackten Verzeichnis `python3 run.py` aus. Unter Windows lautet der Befehl `py -3 run.py`. Die Standardadresse ist `http://127.0.0.1:17473/`. Mit demselben Browser und derselben Adresse kannst du deine gespeicherten Projekte wieder öffnen. Strg+C im Terminal beendet den Server. Modelle und Schriften sind in der ZIP-Datei enthalten.

[Bildnachweise, Modelle und Lizenzen](CREDITS.md)
