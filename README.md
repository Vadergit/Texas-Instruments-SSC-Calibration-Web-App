# Texas Instruments SSC Calibration Web App

[Kalibrierassistent](https://vadergit.github.io/Texas-Instruments-SSC-Calibration-Web-App/?model=pga300) · [SSC Calibration Studio](https://vadergit.github.io/SSC-Calibration-Studio/)

## PGA300 – geführter Offline-Laborprototyp

Standardansicht mit sechs Aufgabenkacheln, Seitenleiste, Fortschrittsanzeige und Hell-/Dunkelmodus nach dem Bedienkonzept der [ELMOS-Master-App](https://github.com/Vadergit/ELMOS-E703.11-Calibration-Web-App). PGA302, PGA305 und PGA309 behalten ihre bisherige lineare Simulation.

### Ablauf
1. Erfassungsmodus und Sensor definieren. Manuelle Eingabe oder klar markierte synthetische Daten.
2. Messkonzept: 2P1T, 2P3T, 3P3T, 4P4T oder individuelle Matrix (2–5 P, 1–4 T, Ordnung P 1–3, T 0–3).
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
- Kein kontinuierliches Hardwarelogging oder dauerhaftes Archiv; Berichte werden lokal heruntergeladen.
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

Für einen Offline-Bedientest: Simulation wählen, 4P4T wählen, AFE bestätigen, Simulationsdaten laden, berechnen, synthetischen Prüfpunkt laden und prüfen, Bericht exportieren. Anschliessend mit echten extern erfassten Daten wiederholen. Die fünf Rechen-Regressionen wurden zusätzlich in einer JavaScript-Laufzeit geprüft. Ein Browser-End-to-End-Test und Hardwaretests stehen aus.
