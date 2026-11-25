# PGA300 v0.4.0 – Labor-Testfreigabe
Stand: experimentell; keine Produktionsfreigabe.
## Testreihenfolge
1. Browser: Offline-Simulation (Schnell, TK0, TK0/TKE, 4P4T); Berichte exportieren, Nachmessung und Archiv prüfen.
2. Programmer: ESP32-C3 oder Pro Micro mit passendem OWI-Frontend (siehe PGA300-ADAPTERS.md). Firmware kompilieren und flashen. TI EVM nur mit verifiziertem SDK und Boardrevision. Analogfrontend mit Scope prüfen; GPIO nie direkt an PWR. Keine automatische Aktivierung fremder Adapter.
3. Entbehrlicher Testchip, strombegrenzte Versorgung: Verbindung, 128 EEPROM-Bytes lesen und CRC vergleichen. Original .bin speichern. Schreibfreigabe bleibt standardmässig aus.
4. AFE und ADC: Min/Max messen, Gain-Vorschlag anwenden, bei konstanter AFE alle Messpunkte erfassen. DAC-Test bei geprüfter Last. Zwei externe Istwerte messen, Zielcodes berechnen und übernehmen, erneuter Abgleich.
5. Nur wenn Readback und unabhängige Prüfungen plausibel sind: experimentelle EEPROM-Freigabe bewusst einschalten. Linearer Pfad gemäss SLDS204D Eq. 5; TC/NL-Kandidaten bleiben gesperrt. Originalbackup, Diff, CRC, Bestätigung, Seitenrücklesung. Fehler stoppen weitere Schreibversuche.
6. Execution-Modus, Versorgung aus/ein, reale analoge Soll-/Istwerte prüfen. Neu verbinden und EEPROM mit Zielimage vergleichen. Kaltstart ist vom Benutzer zu bestätigen; App kann Versorgungsausfall nicht selbst nachweisen.
7. Restore nur aus einem 128-Byte-Backup mit CRC und identischen geschützten Bytes, insbesondere Seriennummer/Factory-Inhalt; Seriennummer ist keine unveränderliche Chip-ID. Keine automatische Wiederherstellung nach Stromausfall.
## Noch nicht freigegeben
TI-Dokumente zur Q14-Skalierung unterscheiden sich beim konstanten Term h0. Kandidat und Vergleich sind nur numerische Testwerkzeuge. Keine vollständige bitgenaue TC/NL-Simulation und keine TC/NL-Programmierung. Weitere offene Punkte: echte Adapter-/Firmware-/EVM-Verifikation, automatisches DMM, vollautomatischer AFE-Abgleich, Schaltung/PCB, direkte USB2ANY-Browseranbindung, kompletter ELMOS-Archiv-/Report-/Sprachumfang, PGA302/PGA305/PGA309. Keine falsche Funktionsfreigabe.
## Tests
`node --test tests/*.test.mjs`. Hardwaretests benötigen echten Prüfplatz. Die Softwaretests ersetzen keine elektrische oder metrologische Validierung.
