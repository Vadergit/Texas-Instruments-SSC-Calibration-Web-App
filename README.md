# Texas Instruments SSC Calibration Web App

[Kalibrierassistent](https://vadergit.github.io/Texas-Instruments-SSC-Calibration-Web-App/?model=pga300) · [SSC Calibration Studio](https://vadergit.github.io/SSC-Calibration-Studio/)

## PGA300 – geführter Offline-Laborprototyp

Version 0.2.0: acht Aufgabenkacheln, originaler Header und kopierte Stylesheets (`master-*.css`) aus ELMOS v0.7.173, Seitenleiste, Fortschrittsanzeige und Hell-/Dunkelmodus nach dem Bedienkonzept der [ELMOS-Master-App](https://github.com/Vadergit/ELMOS-E703.11-Calibration-Web-App). PGA302, PGA305 und PGA309 behalten ihre bisherige lineare Simulation.

### Ablauf
1. Erfassungsmodus und Sensor definieren. Manuelle Eingabe oder klar markierte synthetische Daten.
2. Messkonzept: 2P1T, TK0 (3 Punkte), TK0+TKE (4 Punkte), 2P3T, 4P4T oder individuelle Matrix (2–5 P, 1–4 T, Ordnung P 1–3, T 0–3).
3. Druckbereich (Standard 0–100 %), physische Temperaturstufen und DAC-Zielcodes bestimmen.
4. AFE am externen Messaufbau einstellen und konstant halten. Einstellungen dokumentieren und bestätigen.
5. PADC/TADC als vorzeichenbehaftete 16-bit Codes eingeben; Modell berechnen.
6. Unabhängige ADC-Prüfpunkte mit DAC-Soll und optionalem DAC-Ist erfassen; Modellresiduen und Toleranz beurteilen.
7. Ausgangs- und Clamp-Zielwerte dokumentieren.
8. JSON-Bericht, CSV oder Browser-Druck/PDF erstellen. Config-Export/-Import enthält keine Sensor-ID und keine Messpunkte.

### Rechenmodell
TI SLDS204D §6.3.11.2, Gl. 4: Tensorpolynom mit maximal 16 Termen. Die App nutzt normierte rohe ADC-Koordinaten und eine QR-basierte Ausgleichsrechnung. Die ausgegebenen h/g/n/m-Modellparameter sind **keine** EEPROM-Wörter. Für den linearen Spezialfall wird zusätzlich der Rechenansatz aus Gl. 5 bei angenommener digitaler Identität angezeigt; auch dieser ist nicht zur Programmierung freigegeben. Die Verifikation ist eine Offline-Modellprüfung; auch manuell eingetragene Ist-Werte sind kein automatisches Chip-Readback.

### Bewusste Grenzen
- Kein validierter OWI-Adapter, keine Chipidentifikation, keine Live-ADC-Abfrage oder AFE-Schreibfunktion.
- Keine automatische Umrechnung physischer Spannung/Strom in DAC-Codes, keine vollständige TC/NL-Festkomma-Quantisierung, kein EEPROM-Image, keine CRC- oder Schreibfreigabe.
- Manuelles Logging, Brückenrechner für externe mV/V-Messungen, Binär-Viewer und lokales Browserarchiv verfügbar. Kein kontinuierliches Hardwarelogging, keine EEPROM-Rückrechnung und kein Dateisystem-Archiv wie beim Master.
- Vor realer Programmierung sind TI-Referenzrechner, Hardwarevergleich, vollständige EEPROM-Sicherung, reservierte Bits, CRC, Rücklesen und Kaltstart zu validieren.
- Kein Produktionsfreigabestatus. Ein USB-UART ist nicht gleich einer OWI-Schnittstelle.

### Öffentliche technische Quellen
- [PGA300 Datenblatt SLDS204D, Februar 2025](https://www.ti.com/lit/ds/symlink/pga300.pdf), insbesondere §6.3.11.1–3 (Modell, Clamps), §7.4.2–5 (ADC und Koeffizienten), §6.5 und §7.3 (EEPROM).
- [PGA300 Produktseite / TI Tools](https://www.ti.com/product/PGA300), insbesondere PGA3XX-COEFF-CALC.
- Die private Arbeitsbibliothek wurde im Dateibaum geprüft. Die dortige PGA300-PDF war nur als LFS-Zeiger verfügbar; keine privaten Dateien wurden in dieses öffentliche Projekt kopiert.

## Lokal starten und testen

Im ausgecheckten Projektordner:
```sh
python3 -m http.server 8000 --bind 127.0.0.1
node --test tests/pga300.test.mjs
```
Öffnen: http://127.0.0.1:8000/?model=pga300

Für einen Offline-Bedientest: Simulation wählen, 4P4T wählen, AFE bestätigen, Simulationsdaten laden, berechnen, synthetischen Prüfpunkt laden und prüfen, Bericht exportieren. Anschliessend mit echten extern erfassten Daten wiederholen. Die sechs Rechen-Regressionen wurden zusätzlich in einer JavaScript-Laufzeit geprüft. Ein Browser-End-to-End-Test und Hardwaretests stehen aus.

## v0.3.0 – experimenteller Hardwarepfad

Web Serial + ESP32-C3 OWI-Firmware, 128-Byte-EEPROM-Dump und CRC, AFE-RAM-Rücklesung, ADC-Erfassung und linearer Testchip-Schreibpfad mit Backup und Seitenprüfung. Siehe [OWI-Aufbau und Grenzen](docs/PGA300-OWI.md). Die früheren Offline-Grenzen gelten weiterhin für TC/NL-Festkomma, automatische AFE-Optimierung, TI EVM, DAC-Hardwareprüfung und produktive Freigabe. Sechs zusätzliche Hardwaretreiber-Tests verwenden einen simulierten Register-/EEPROM-Transport; keine echte Hardwarevalidierung.

`node --test tests/*.test.mjs`

### v0.3.1
Zusätzlich Gain-Empfehlung, RAM-Ausgangsparameter, DAC-Test, separate Ausgang-/Diagnose-EEPROM-Patches und Intervall-Logging. 9 Hardware-Transporttests + 6 Rechentests in einer JavaScript-Laufzeit erfolgreich. Kein echter Hardware-, Firmware-Build- oder Browser-End-to-End-Test. Siehe aktuelle [OWI-Dokumentation](docs/PGA300-OWI.md); ältere Offline-Beschreibungen dokumentieren den ursprünglichen Stand.

### v0.3.2
OWI corrected from 38400 to 9600 baud per TI §5.18. Bridge v2 required. Fresh CRC validation, stale backup invalidation, write-failure latch, real capture provenance, module cache versioning. 12 mock driver tests pass in JS runtime. No real hardware or firmware build yet.

### v0.3.3
ESP32-C3 and Arduino Pro Micro Web Serial programmer sketches plus experimental local Windows TI USB2ANY SDK transport. Three additional mocked adapter tests. Details: [PGA300-ADAPTERS](docs/PGA300-ADAPTERS.md). Hardware/SDK and firmware builds are not validated.
