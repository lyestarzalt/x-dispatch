#!/usr/bin/env node
// One-shot: apply translations for keys added in the 2026-05-16 i18n migration.
// Reads each locale file, replaces matching paths with locale-specific text,
// preserves all other keys untouched. Run once: `node scripts/apply-translations.mjs`.
//
// Aviation acronyms (METAR, TAF, ATIS, NOTAM, ILS, FL, RWY, SID, STAR, V1, VR,
// V2, Vref, ETE, ZFW, TOW, LDW, OEW, CI, QNH, AIRAC, FIR, GS, CAVOK, IFR, VFR,
// TLR, MORA) and unit abbreviations are kept in their original Latin form
// in every locale — that's the convention in international aviation.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LOCALES_DIR = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));
const LOCALES = ['de', 'es', 'fr', 'it', 'ja', 'pl', 'pt', 'ru', 'zh', 'pirate'];

// Translation map. Key is the dotted path in en.json. Value is { locale: text }.
// Values with {{interp}} placeholders must preserve them verbatim.
const T = {
  // ── units ───────────────────────────────────────────────────────────────
  // Universal abbreviations — same across locales for international aviation.
  'units.lbs': { de:'lbs', es:'lbs', fr:'lbs', it:'lbs', ja:'lbs', pl:'lbs', pt:'lbs', ru:'фунт', zh:'磅', pirate:'doubloons' },
  'units.kts': { de:'kts', es:'kts', fr:'kts', it:'kts', ja:'kts', pl:'kts', pt:'kts', ru:'уз', zh:'节', pirate:'kts' },
  'units.ms':  { de:'m/s', es:'m/s', fr:'m/s', it:'m/s', ja:'m/s', pl:'m/s', pt:'m/s', ru:'м/с', zh:'米/秒', pirate:'m/s' },

  // ── toolbar additions ───────────────────────────────────────────────────
  'toolbar.alphaTag':       { de:'Alpha', es:'alfa', fr:'alpha', it:'alpha', ja:'アルファ', pl:'alfa', pt:'alfa', ru:'альфа', zh:'测试', pirate:'arrr-pha' },
  'toolbar.rangeRingsHours':{ de:'{{n}}h', es:'{{n}}h', fr:'{{n}}h', it:'{{n}}h', ja:'{{n}}時間', pl:'{{n}}h', pt:'{{n}}h', ru:'{{n}}ч', zh:'{{n}}小时', pirate:'{{n}}h' },
  'toolbar.rangeRingsKts':  { de:'{{speed}}kts', es:'{{speed}}kts', fr:'{{speed}}kts', it:'{{speed}}kts', ja:'{{speed}}kts', pl:'{{speed}}kts', pt:'{{speed}}kts', ru:'{{speed}}уз', zh:'{{speed}}节', pirate:'{{speed}}kts' },
  'toolbar.pinCoords':      { de:'{{lat}}°, {{lon}}°', es:'{{lat}}°, {{lon}}°', fr:'{{lat}}°, {{lon}}°', it:'{{lat}}°, {{lon}}°', ja:'{{lat}}°, {{lon}}°', pl:'{{lat}}°, {{lon}}°', pt:'{{lat}}°, {{lon}}°', ru:'{{lat}}°, {{lon}}°', zh:'{{lat}}°, {{lon}}°', pirate:'{{lat}}°, {{lon}}°' },

  // ── airportInfo additions ───────────────────────────────────────────────
  'airportInfo.noWeather': { de:'Keine Wetterdaten verfügbar', es:'No hay datos meteorológicos disponibles', fr:'Aucune donnée météo disponible', it:'Nessun dato meteo disponibile', ja:'気象データなし', pl:'Brak danych pogodowych', pt:'Sem dados meteorológicos', ru:'Нет данных о погоде', zh:'无气象数据', pirate:'No weather scrolls available, matey' },
  'airportInfo.conditions.wind':       { de:'Wind', es:'Viento', fr:'Vent', it:'Vento', ja:'風', pl:'Wiatr', pt:'Vento', ru:'Ветер', zh:'风', pirate:'Wind o\' the seas' },
  'airportInfo.conditions.visibility': { de:'Sicht', es:'Visibilidad', fr:'Visibilité', it:'Visibilità', ja:'視程', pl:'Widoczność', pt:'Visibilidade', ru:'Видимость', zh:'能见度', pirate:'Spyglass range' },
  'airportInfo.conditions.ceiling':    { de:'Wolkenuntergrenze', es:'Techo', fr:'Plafond', it:'Soffitto', ja:'シーリング', pl:'Pułap chmur', pt:'Teto', ru:'Высота облачности', zh:'云底高', pirate:'Cloud ceilin\'' },
  'airportInfo.conditions.qnh':        { de:'QNH', es:'QNH', fr:'QNH', it:'QNH', ja:'QNH', pl:'QNH', pt:'QNH', ru:'QNH', zh:'QNH', pirate:'QNH' },
  'airportInfo.conditions.tempDew':    { de:'Temp / Taupunkt', es:'Temp / Punto rocío', fr:'Temp / Pt rosée', it:'Temp / Punto rugiada', ja:'気温 / 露点', pl:'Temp / Pkt rosy', pt:'Temp / Pt orvalho', ru:'Темп / Точка росы', zh:'温度 / 露点', pirate:'Temp / Dewdrop' },
  'airportInfo.conditions.tempDewValue':{ de:'{{temp}}°C / {{dew}}°C', es:'{{temp}}°C / {{dew}}°C', fr:'{{temp}}°C / {{dew}}°C', it:'{{temp}}°C / {{dew}}°C', ja:'{{temp}}°C / {{dew}}°C', pl:'{{temp}}°C / {{dew}}°C', pt:'{{temp}}°C / {{dew}}°C', ru:'{{temp}}°C / {{dew}}°C', zh:'{{temp}}°C / {{dew}}°C', pirate:'{{temp}}°C / {{dew}}°C' },
  'airportInfo.conditions.phenomena':  { de:'Phänomene', es:'Fenómenos', fr:'Phénomènes', it:'Fenomeni', ja:'気象現象', pl:'Zjawiska', pt:'Fenómenos', ru:'Явления', zh:'天气现象', pirate:'Weather omens' },
  'airportInfo.activeRunway':          { de:'Aktive Piste', es:'Pista activa', fr:'Piste en service', it:'Pista attiva', ja:'使用滑走路', pl:'Aktywny pas', pt:'Pista ativa', ru:'Активная ВПП', zh:'使用跑道', pirate:'Active landin\' strip' },
  'airportInfo.windAligned':           { de:'· windorientiert, {{delta}}° versetzt', es:'· alineada con viento, {{delta}}° desvío', fr:'· alignée vent, {{delta}}° d\'écart', it:'· allineata col vento, {{delta}}° di scarto', ja:'· 風向沿い, {{delta}}°ずれ', pl:'· zgodna z wiatrem, {{delta}}° odchylenia', pt:'· alinhada com vento, {{delta}}° de desvio', ru:'· по ветру, {{delta}}° смещение', zh:'· 顺风, 偏差{{delta}}°', pirate:'· wind-blown, {{delta}}° askew' },
  'airportInfo.atisLabel':             { de:'ATIS {{letter}}', es:'ATIS {{letter}}', fr:'ATIS {{letter}}', it:'ATIS {{letter}}', ja:'ATIS {{letter}}', pl:'ATIS {{letter}}', pt:'ATIS {{letter}}', ru:'ATIS {{letter}}', zh:'ATIS {{letter}}', pirate:'ATIS {{letter}}' },
  'airportInfo.runwaysHeading':        { de:'Pisten', es:'Pistas', fr:'Pistes', it:'Piste', ja:'滑走路', pl:'Pasy startowe', pt:'Pistas', ru:'ВПП', zh:'跑道', pirate:'Landin\' strips' },
  'airportInfo.runwayCountTotal':      { de:'{{count}} insgesamt', es:'{{count}} en total', fr:'{{count}} au total', it:'{{count}} in totale', ja:'計 {{count}}', pl:'łącznie {{count}}', pt:'{{count}} no total', ru:'всего {{count}}', zh:'共 {{count}} 条', pirate:'{{count}} all told' },
  'airportInfo.runwayLengthFt':        { de:"{{length}}'", es:"{{length}}'", fr:"{{length}}'", it:"{{length}}'", ja:"{{length}}'", pl:"{{length}}'", pt:"{{length}}'", ru:"{{length}}'", zh:"{{length}}'", pirate:"{{length}}'" },
  'airportInfo.runwayName':            { de:'Piste {{name}}', es:'Pista {{name}}', fr:'Piste {{name}}', it:'Pista {{name}}', ja:'滑走路 {{name}}', pl:'Pas {{name}}', pt:'Pista {{name}}', ru:'ВПП {{name}}', zh:'跑道 {{name}}', pirate:'Strip {{name}}' },
  'airportInfo.ils.frequency':         { de:'Frequenz', es:'Frecuencia', fr:'Fréquence', it:'Frequenza', ja:'周波数', pl:'Częstotliwość', pt:'Frequência', ru:'Частота', zh:'频率', pirate:'Frequency' },
  'airportInfo.ils.localizer':         { de:'Localizer', es:'Localizador', fr:'Localizer', it:'Localizzatore', ja:'ローカライザー', pl:'Localizer', pt:'Localizador', ru:'Курсовой', zh:'航向台', pirate:'Course-finder' },
  'airportInfo.ils.glideslope':        { de:'Gleitpfad', es:'Senda planeo', fr:'Pente d\'app.', it:'Sentiero discesa', ja:'グライドスロープ', pl:'Ścieżka schodzenia', pt:'Rampa descida', ru:'Глиссада', zh:'下滑道', pirate:'Glide-path' },
  'airportInfo.ils.range':             { de:'Reichweite', es:'Alcance', fr:'Portée', it:'Portata', ja:'有効範囲', pl:'Zasięg', pt:'Alcance', ru:'Дальность', zh:'范围', pirate:'Range' },
  'airportInfo.ils.ident':             { de:'Kennung', es:'Identif.', fr:'Indicatif', it:'Identif.', ja:'識別符号', pl:'Identyfikator', pt:'Identif.', ru:'Идент.', zh:'识别码', pirate:'Ident' },
  'airportInfo.ils.rangeNm':           { de:'{{value}} NM', es:'{{value}} NM', fr:'{{value}} NM', it:'{{value}} NM', ja:'{{value}} NM', pl:'{{value}} NM', pt:'{{value}} NM', ru:'{{value}} ММ', zh:'{{value}} NM', pirate:'{{value}} NM' },
  'airportInfo.rawMetar':              { de:'Roh-METAR', es:'METAR sin procesar', fr:'METAR brut', it:'METAR grezzo', ja:'生METAR', pl:'Surowy METAR', pt:'METAR bruto', ru:'Сырой METAR', zh:'原始 METAR', pirate:'Raw METAR scroll' },
  'airportInfo.noRunwaysMatching':     { de:'Keine Pisten passend zu "{{query}}"', es:'No hay pistas que coincidan con "{{query}}"', fr:'Aucune piste correspondant à "{{query}}"', it:'Nessuna pista corrispondente a "{{query}}"', ja:'"{{query}}"に一致する滑走路なし', pl:'Brak pasów pasujących do "{{query}}"', pt:'Nenhuma pista corresponde a "{{query}}"', ru:'Нет ВПП по запросу "{{query}}"', zh:'未找到匹配 "{{query}}" 的跑道', pirate:'No strips matchin\' "{{query}}", matey' },
  'airportInfo.noHelipads':            { de:'Keine Hubschrauberlandeplätze', es:'No hay helipuertos', fr:'Aucun héliport', it:'Nessun eliporto', ja:'ヘリパッドなし', pl:'Brak lądowisk', pt:'Sem helipontos', ru:'Нет вертолётных площадок', zh:'无直升机停机坪', pirate:'No helo-perches found' },
  'airportInfo.noHelipadsMatching':    { de:'Keine Hubschrauberlandeplätze passend zu "{{query}}"', es:'No hay helipuertos que coincidan con "{{query}}"', fr:'Aucun héliport correspondant à "{{query}}"', it:'Nessun eliporto corrispondente a "{{query}}"', ja:'"{{query}}"に一致するヘリパッドなし', pl:'Brak lądowisk pasujących do "{{query}}"', pt:'Nenhum heliponto corresponde a "{{query}}"', ru:'Нет площадок по запросу "{{query}}"', zh:'未找到匹配 "{{query}}" 的停机坪', pirate:'No helo-perches matchin\' "{{query}}"' },
  'airportInfo.runwayDimensions':      { de:"{{length}}'×{{width}}'", es:"{{length}}'×{{width}}'", fr:"{{length}}'×{{width}}'", it:"{{length}}'×{{width}}'", ja:"{{length}}'×{{width}}'", pl:"{{length}}'×{{width}}'", pt:"{{length}}'×{{width}}'", ru:"{{length}}'×{{width}}'", zh:"{{length}}'×{{width}}'", pirate:"{{length}}'×{{width}}'" },
  'airportInfo.routeTab.tabApproach':        { de:'Anflug', es:'Aprox.', fr:'Approche', it:'Avvicin.', ja:'進入', pl:'Podejście', pt:'Aproxim.', ru:'Заход', zh:'进近', pirate:'Approach' },
  'airportInfo.routeTab.noneAvailable':      { de:'Keine {{type}} verfügbar', es:'Sin {{type}} disponibles', fr:'Aucun {{type}} disponible', it:'Nessun {{type}} disponibile', ja:'{{type}}なし', pl:'Brak dostępnych {{type}}', pt:'Sem {{type}} disponíveis', ru:'Нет {{type}}', zh:'无可用 {{type}}', pirate:'No {{type}} available' },
  'airportInfo.routeTab.noneApproaches':     { de:'Keine Anflüge verfügbar', es:'Sin aproximaciones disponibles', fr:'Aucune approche disponible', it:'Nessun avvicinamento disponibile', ja:'進入手順なし', pl:'Brak dostępnych podejść', pt:'Sem aproximações disponíveis', ru:'Нет заходов', zh:'无可用进近', pirate:'No approaches available' },
  'airportInfo.routeTab.transitionCount_one':   { de:'1 Transition', es:'1 transición', fr:'1 transition', it:'1 transizione', ja:'トランジション 1', pl:'1 przejście', pt:'1 transição', ru:'1 переход', zh:'1 个过渡', pirate:'1 transition' },
  'airportInfo.routeTab.transitionCount_other': { de:'{{count}} Transitionen', es:'{{count}} transiciones', fr:'{{count}} transitions', it:'{{count}} transizioni', ja:'トランジション {{count}}', pl:'{{count}} przejść', pt:'{{count}} transições', ru:'{{count}} переходов', zh:'{{count}} 个过渡', pirate:'{{count}} transitions' },
  'airportInfo.routeTab.runwayVariantCount_one':   { de:'1 Piste', es:'1 pista', fr:'1 piste', it:'1 pista', ja:'滑走路 1', pl:'1 pas', pt:'1 pista', ru:'1 ВПП', zh:'1 条跑道', pirate:'1 strip' },
  'airportInfo.routeTab.runwayVariantCount_other': { de:'{{count}} Pisten', es:'{{count}} pistas', fr:'{{count}} pistes', it:'{{count}} piste', ja:'滑走路 {{count}}', pl:'{{count}} pasów', pt:'{{count}} pistas', ru:'{{count}} ВПП', zh:'{{count}} 条跑道', pirate:'{{count}} strips' },
  'airportInfo.routeTab.variantCount_one':   { de:'1 Variante', es:'1 variante', fr:'1 variante', it:'1 variante', ja:'バリアント 1', pl:'1 wariant', pt:'1 variante', ru:'1 вариант', zh:'1 个变体', pirate:'1 variant' },
  'airportInfo.routeTab.variantCount_other': { de:'{{count}} Varianten', es:'{{count}} variantes', fr:'{{count}} variantes', it:'{{count}} varianti', ja:'バリアント {{count}}', pl:'{{count}} wariantów', pt:'{{count}} variantes', ru:'{{count}} вариантов', zh:'{{count}} 个变体', pirate:'{{count}} variants' },
  'airportInfo.routeTab.allVariants':        { de:'Alle', es:'Todos', fr:'Tous', it:'Tutti', ja:'すべて', pl:'Wszystkie', pt:'Todos', ru:'Все', zh:'全部', pirate:'All' },

  // ── weightBalance ───────────────────────────────────────────────────────
  'weightBalance.title':    { de:'Gewicht & Treibstoff', es:'Peso y Combustible', fr:'Masse & Carburant', it:'Peso e Carburante', ja:'重量と燃料', pl:'Masa i Paliwo', pt:'Peso e Combustível', ru:'Масса и Топливо', zh:'重量与燃料', pirate:'Booty & Grog' },
  'weightBalance.empty':    { de:'Leer', es:'Vacío', fr:'À vide', it:'Vuoto', ja:'空虚', pl:'Pusty', pt:'Vazio', ru:'Пустой', zh:'空机', pirate:'Empty hold' },
  'weightBalance.fuel':     { de:'Treibstoff', es:'Combustible', fr:'Carburant', it:'Carburante', ja:'燃料', pl:'Paliwo', pt:'Combustível', ru:'Топливо', zh:'燃油', pirate:'Grog' },
  'weightBalance.payload':  { de:'Nutzlast', es:'Carga útil', fr:'Charge utile', it:'Carico utile', ja:'ペイロード', pl:'Ładunek', pt:'Carga útil', ru:'Полезная нагрузка', zh:'载重', pirate:'Cargo o\' plunder' },
  'weightBalance.total':    { de:'Gesamt', es:'Total', fr:'Total', it:'Totale', ja:'合計', pl:'Razem', pt:'Total', ru:'Итого', zh:'总计', pirate:'Grand sum' },
  'weightBalance.max':      { de:'Max.', es:'Máx.', fr:'Max.', it:'Max.', ja:'最大', pl:'Maks.', pt:'Máx.', ru:'Макс.', zh:'最大', pirate:'Max' },
  'weightBalance.over':     { de:'+{{amount}} über', es:'+{{amount}} excedido', fr:'+{{amount}} en surcharge', it:'+{{amount}} oltre', ja:'+{{amount}} 超過', pl:'+{{amount}} ponad', pt:'+{{amount}} acima', ru:'+{{amount}} превышение', zh:'+{{amount}} 超重', pirate:'+{{amount}} too heavy, arr!' },
  'weightBalance.allTanks': { de:'Alle Tanks', es:'Todos los tanques', fr:'Tous réservoirs', it:'Tutti i serbatoi', ja:'全タンク', pl:'Wszystkie zbiorniki', pt:'Todos tanques', ru:'Все баки', zh:'所有油箱', pirate:'All grog kegs' },
  'weightBalance.done':     { de:'Fertig', es:'Listo', fr:'Terminé', it:'Fatto', ja:'完了', pl:'Gotowe', pt:'Pronto', ru:'Готово', zh:'完成', pirate:'Aye, done' },
  'weightBalance.tankValue':         { de:'{{pct}}% ({{weight}})', es:'{{pct}}% ({{weight}})', fr:'{{pct}}% ({{weight}})', it:'{{pct}}% ({{weight}})', ja:'{{pct}}% ({{weight}})', pl:'{{pct}}% ({{weight}})', pt:'{{pct}}% ({{weight}})', ru:'{{pct}}% ({{weight}})', zh:'{{pct}}% ({{weight}})', pirate:'{{pct}}% ({{weight}})' },
  'weightBalance.overallFuelValue':  { de:'{{pct}}% ({{weight}})', es:'{{pct}}% ({{weight}})', fr:'{{pct}}% ({{weight}})', it:'{{pct}}% ({{weight}})', ja:'{{pct}}% ({{weight}})', pl:'{{pct}}% ({{weight}})', pt:'{{pct}}% ({{weight}})', ru:'{{pct}}% ({{weight}})', zh:'{{pct}}% ({{weight}})', pirate:'{{pct}}% ({{weight}})' },

  // ── flightInfoPanel ─────────────────────────────────────────────────────
  'flightInfoPanel.tabs.route':   { de:'Route', es:'Ruta', fr:'Route', it:'Rotta', ja:'ルート', pl:'Trasa', pt:'Rota', ru:'Маршрут', zh:'航路', pirate:'Course' },
  'flightInfoPanel.tabs.fuel':    { de:'Treibst.', es:'Combust.', fr:'Carbur.', it:'Carbur.', ja:'燃料', pl:'Paliwo', pt:'Combust.', ru:'Топл.', zh:'燃油', pirate:'Grog' },
  'flightInfoPanel.tabs.weight':  { de:'Gewicht', es:'Peso', fr:'Masse', it:'Peso', ja:'重量', pl:'Masa', pt:'Peso', ru:'Масса', zh:'重量', pirate:'Heft' },
  'flightInfoPanel.tabs.wx':      { de:'WX', es:'MET', fr:'MET', it:'MET', ja:'気象', pl:'WX', pt:'MET', ru:'Погода', zh:'气象', pirate:'WX' },
  'flightInfoPanel.avgWind':      { de:'Mittl. Wind', es:'Viento med.', fr:'Vent moy.', it:'Vento med.', ja:'平均風', pl:'Śr. wiatr', pt:'Vento méd.', ru:'Сред. ветер', zh:'平均风', pirate:'Avg wind' },
  'flightInfoPanel.blockFuel':    { de:'Blockkraftstoff', es:'Comb. bloque', fr:'Carb. bloc', it:'Carb. blocco', ja:'ブロック燃料', pl:'Paliwo blokowe', pt:'Comb. bloco', ru:'Топ. блок', zh:'轮挡油', pirate:'Block grog' },
  'flightInfoPanel.landing':      { de:'Landung', es:'Aterriz.', fr:'Atterriss.', it:'Atterragg.', ja:'着陸', pl:'Lądowanie', pt:'Aterragem', ru:'Посадка', zh:'着陆', pirate:'Touchdown' },
  'flightInfoPanel.paxCargo':     { de:'PAX / Fracht', es:'PAX / Carga', fr:'PAX / Fret', it:'PAX / Carico', ja:'PAX / 貨物', pl:'PAX / Ładunek', pt:'PAX / Carga', ru:'PAX / Груз', zh:'乘客 / 货物', pirate:'PAX / Loot' },
  'flightInfoPanel.alternate':    { de:'Ausweichflugh.', es:'Alternativo', fr:'Déroutement', it:'Alternato', ja:'代替', pl:'Zapasowe', pt:'Alternado', ru:'Запасной', zh:'备降', pirate:'Alt port' },
  'flightInfoPanel.blockLabel':   { de:'Block', es:'Bloque', fr:'Bloc', it:'Blocco', ja:'ブロック', pl:'Blok', pt:'Bloco', ru:'Блок', zh:'轮挡', pirate:'Block' },
  'flightInfoPanel.landingLabel': { de:'Landung', es:'Aterriz.', fr:'Atterr.', it:'Atterragg.', ja:'着陸', pl:'Lądow.', pt:'Aterrag.', ru:'Посадка', zh:'着陆', pirate:'Touchdown' },
  'flightInfoPanel.passengers':   { de:'Passagiere', es:'Pasajeros', fr:'Passagers', it:'Passeggeri', ja:'乗客', pl:'Pasażerowie', pt:'Passageiros', ru:'Пассажиры', zh:'乘客', pirate:'Souls aboard' },
  'flightInfoPanel.cargo':        { de:'Fracht', es:'Carga', fr:'Fret', it:'Carico', ja:'貨物', pl:'Ładunek', pt:'Carga', ru:'Груз', zh:'货物', pirate:'Loot' },
  'flightInfoPanel.payload':      { de:'Nutzlast', es:'Carga útil', fr:'Charge utile', it:'Carico utile', ja:'ペイロード', pl:'Ładunek', pt:'Carga útil', ru:'Полезная нагрузка', zh:'载重', pirate:'Plunder' },
  'flightInfoPanel.wind':         { de:'Wind', es:'Viento', fr:'Vent', it:'Vento', ja:'風', pl:'Wiatr', pt:'Vento', ru:'Ветер', zh:'风', pirate:'Wind' },
  'flightInfoPanel.vis':          { de:'Sicht', es:'Vis', fr:'Vis', it:'Vis', ja:'視程', pl:'Widocz.', pt:'Vis', ru:'Вид', zh:'能见', pirate:'Spy' },
  'flightInfoPanel.temp':         { de:'Temp', es:'Temp', fr:'Temp', it:'Temp', ja:'気温', pl:'Temp', pt:'Temp', ru:'Темп', zh:'温度', pirate:'Temp' },
  'flightInfoPanel.tempDeg':      { de:'{{value}}°', es:'{{value}}°', fr:'{{value}}°', it:'{{value}}°', ja:'{{value}}°', pl:'{{value}}°', pt:'{{value}}°', ru:'{{value}}°', zh:'{{value}}°', pirate:'{{value}}°' },
  'flightInfoPanel.qnh':          { de:'QNH', es:'QNH', fr:'QNH', it:'QNH', ja:'QNH', pl:'QNH', pt:'QNH', ru:'QNH', zh:'QNH', pirate:'QNH' },
  'flightInfoPanel.noMetar':      { de:'Kein METAR', es:'Sin METAR', fr:'Pas de METAR', it:'Nessun METAR', ja:'METARなし', pl:'Brak METAR', pt:'Sem METAR', ru:'Нет METAR', zh:'无 METAR', pirate:'No METAR scroll' },
  'flightInfoPanel.fuelItems.taxi':        { de:'Taxi', es:'Rodaje', fr:'Roulage', it:'Rullaggio', ja:'タクシー', pl:'Kołowanie', pt:'Táxi', ru:'Руление', zh:'滑行', pirate:'Taxi' },
  'flightInfoPanel.fuelItems.trip':        { de:'Reise', es:'Viaje', fr:'Voyage', it:'Viaggio', ja:'飛行', pl:'Trasa', pt:'Viagem', ru:'Маршрут', zh:'航段', pirate:'Voyage' },
  'flightInfoPanel.fuelItems.contingency': { de:'Reserve', es:'Contingencia', fr:'Réserve route', it:'Contingenza', ja:'予備', pl:'Awaryjne', pt:'Contingência', ru:'Запасное', zh:'备用', pirate:'Just-in-case' },
  'flightInfoPanel.fuelItems.alternate':   { de:'Ausweich', es:'Alternativo', fr:'Dégagement', it:'Alternato', ja:'代替', pl:'Zapasowe', pt:'Alternativo', ru:'Запасной', zh:'备降', pirate:'Alt port' },
  'flightInfoPanel.fuelItems.reserve':     { de:'Reserve', es:'Reserva', fr:'Réserve', it:'Riserva', ja:'リザーブ', pl:'Rezerwa', pt:'Reserva', ru:'Резерв', zh:'保留', pirate:'Reserve' },
  'flightInfoPanel.fuelItems.extra':       { de:'Extra', es:'Extra', fr:'Extra', it:'Extra', ja:'追加', pl:'Dodatkowe', pt:'Extra', ru:'Доп.', zh:'额外', pirate:'Extra' },

  // ── launcher.weatherDialog.ftMsl ────────────────────────────────────────
  'launcher.weatherDialog.ftMsl': { de:'{{value}} ft MSL', es:'{{value}} ft MSL', fr:'{{value}} ft MSL', it:'{{value}} ft MSL', ja:'{{value}} ft MSL', pl:'{{value}} ft MSL', pt:'{{value}} ft MSL', ru:'{{value}} ft MSL', zh:'{{value}} ft MSL', pirate:'{{value}} ft MSL' },

  // ── simbriefDialog top-level ────────────────────────────────────────────
  'simbriefDialog.viewFullOfp':       { de:'Vollständiger OFP (PDF)', es:'OFP completo (PDF)', fr:'OFP complet (PDF)', it:'OFP completo (PDF)', ja:'完全なOFP(PDF)', pl:'Pełny OFP (PDF)', pt:'OFP completo (PDF)', ru:'Полный OFP (PDF)', zh:'完整 OFP (PDF)', pirate:'Full OFP scroll (PDF)' },
  'simbriefDialog.notAvailable':      { de:'k.A.', es:'N/D', fr:'N/D', it:'N/D', ja:'N/A', pl:'b.d.', pt:'N/D', ru:'нет', zh:'无', pirate:'N/A' },
  'simbriefDialog.noMetarAvailable':  { de:'Kein METAR verfügbar', es:'No hay METAR disponible', fr:'Aucun METAR disponible', it:'Nessun METAR disponibile', ja:'METARなし', pl:'Brak METAR', pt:'Sem METAR disponível', ru:'METAR недоступен', zh:'无 METAR 数据', pirate:'No METAR scroll, arr' },

  // ── simbriefDialog.header ───────────────────────────────────────────────
  'simbriefDialog.header.goToAirportLayoutAria': { de:'Zu {{icao}}-Layout', es:'Ir al diseño de {{icao}}', fr:'Aller à la carte de {{icao}}', it:'Vai al layout di {{icao}}', ja:'{{icao}}のレイアウトへ', pl:'Przejdź do układu {{icao}}', pt:'Ir para o layout de {{icao}}', ru:'К схеме {{icao}}', zh:'前往 {{icao}} 布局', pirate:'Set course for {{icao}}' },
  'simbriefDialog.header.runway':                { de:'RWY {{rwy}}', es:'RWY {{rwy}}', fr:'RWY {{rwy}}', it:'RWY {{rwy}}', ja:'RWY {{rwy}}', pl:'RWY {{rwy}}', pt:'RWY {{rwy}}', ru:'RWY {{rwy}}', zh:'RWY {{rwy}}', pirate:'RWY {{rwy}}' },
  'simbriefDialog.header.takeoffWithIcao':       { de:'Start - {{icao}}', es:'Despegue - {{icao}}', fr:'Décollage - {{icao}}', it:'Decollo - {{icao}}', ja:'離陸 - {{icao}}', pl:'Start - {{icao}}', pt:'Decolagem - {{icao}}', ru:'Взлёт - {{icao}}', zh:'起飞 - {{icao}}', pirate:'Cast off - {{icao}}' },
  'simbriefDialog.header.landingWithIcao':       { de:'Landung - {{icao}}', es:'Aterrizaje - {{icao}}', fr:'Atterrissage - {{icao}}', it:'Atterraggio - {{icao}}', ja:'着陸 - {{icao}}', pl:'Lądowanie - {{icao}}', pt:'Aterragem - {{icao}}', ru:'Посадка - {{icao}}', zh:'着陆 - {{icao}}', pirate:'Drop anchor - {{icao}}' },

  // ── simbriefDialog.tabs ─────────────────────────────────────────────────
  'simbriefDialog.tabs.flight':      { de:'Flug', es:'Vuelo', fr:'Vol', it:'Volo', ja:'飛行', pl:'Lot', pt:'Voo', ru:'Полёт', zh:'航班', pirate:'Voyage' },
  'simbriefDialog.tabs.performance': { de:'Leist.', es:'Rend.', fr:'Perf', it:'Prest.', ja:'性能', pl:'Osiągi', pt:'Desemp.', ru:'Хар-ки', zh:'性能', pirate:'Perf' },
  'simbriefDialog.tabs.navlog':      { de:'Navlog', es:'Navlog', fr:'Navlog', it:'Navlog', ja:'ナブログ', pl:'Navlog', pt:'Navlog', ru:'Навлог', zh:'航段记录', pirate:'Logbook' },
  'simbriefDialog.tabs.fuel':        { de:'Treibstoff', es:'Combustible', fr:'Carburant', it:'Carburante', ja:'燃料', pl:'Paliwo', pt:'Combustível', ru:'Топливо', zh:'燃油', pirate:'Grog' },
  'simbriefDialog.tabs.weights':     { de:'Gewichte', es:'Pesos', fr:'Masses', it:'Pesi', ja:'重量', pl:'Masy', pt:'Pesos', ru:'Массы', zh:'重量', pirate:'Heft' },
  'simbriefDialog.tabs.weather':     { de:'Wetter', es:'Meteo', fr:'Météo', it:'Meteo', ja:'気象', pl:'Pogoda', pt:'Meteo', ru:'Погода', zh:'气象', pirate:'Skies' },
  'simbriefDialog.tabs.briefing':    { de:'Briefing', es:'Briefing', fr:'Briefing', it:'Briefing', ja:'ブリーフィング', pl:'Briefing', pt:'Briefing', ru:'Брифинг', zh:'简报', pirate:'Briefin\'' },

  // ── simbriefDialog.stats (aviation acronyms — stay as-is) ───────────────
  'simbriefDialog.stats.ete':     { de:'ETE', es:'ETE', fr:'ETE', it:'ETE', ja:'ETE', pl:'ETE', pt:'ETE', ru:'ETE', zh:'ETE', pirate:'ETE' },
  'simbriefDialog.stats.fl':      { de:'FL', es:'FL', fr:'FL', it:'FL', ja:'FL', pl:'FL', pt:'FL', ru:'FL', zh:'FL', pirate:'FL' },
  'simbriefDialog.stats.avgWind': { de:'MITTL. WIND', es:'VTO MED', fr:'VENT MOY', it:'VENTO MED', ja:'平均風', pl:'ŚR. WIATR', pt:'VTO MED', ru:'СР. ВЕТЕР', zh:'平均风', pirate:'AVG WIND' },
  'simbriefDialog.stats.ci':      { de:'CI', es:'CI', fr:'CI', it:'CI', ja:'CI', pl:'CI', pt:'CI', ru:'CI', zh:'CI', pirate:'CI' },
  'simbriefDialog.stats.airac':   { de:'AIRAC', es:'AIRAC', fr:'AIRAC', it:'AIRAC', ja:'AIRAC', pl:'AIRAC', pt:'AIRAC', ru:'AIRAC', zh:'AIRAC', pirate:'AIRAC' },

  // ── simbriefDialog.flight ───────────────────────────────────────────────
  'simbriefDialog.flight.verticalProfile': { de:'Vertikalprofil', es:'Perfil vertical', fr:'Profil vertical', it:'Profilo verticale', ja:'垂直プロファイル', pl:'Profil pionowy', pt:'Perfil vertical', ru:'Вертикальный профиль', zh:'垂直剖面', pirate:'Up-down profile' },
  'simbriefDialog.flight.sid':             { de:'SID: {{id}}', es:'SID: {{id}}', fr:'SID: {{id}}', it:'SID: {{id}}', ja:'SID: {{id}}', pl:'SID: {{id}}', pt:'SID: {{id}}', ru:'SID: {{id}}', zh:'SID: {{id}}', pirate:'SID: {{id}}' },
  'simbriefDialog.flight.star':            { de:'STAR: {{id}}', es:'STAR: {{id}}', fr:'STAR: {{id}}', it:'STAR: {{id}}', ja:'STAR: {{id}}', pl:'STAR: {{id}}', pt:'STAR: {{id}}', ru:'STAR: {{id}}', zh:'STAR: {{id}}', pirate:'STAR: {{id}}' },
  'simbriefDialog.flight.route':           { de:'Route', es:'Ruta', fr:'Route', it:'Rotta', ja:'ルート', pl:'Trasa', pt:'Rota', ru:'Маршрут', zh:'航路', pirate:'Course' },
  'simbriefDialog.flight.fixesCount':      { de:'{{count}} Fixes', es:'{{count}} fijos', fr:'{{count}} points', it:'{{count}} fix', ja:'{{count}} 個のフィックス', pl:'{{count}} punktów', pt:'{{count}} fixos', ru:'{{count}} точек', zh:'{{count}} 个航点', pirate:'{{count}} marks' },
  'simbriefDialog.flight.fuelSummary':     { de:'Treibstoff-Übersicht', es:'Resumen combust.', fr:'Récapit. carburant', it:'Riepilogo carbur.', ja:'燃料サマリー', pl:'Podsum. paliwa', pt:'Resumo combust.', ru:'Сводка по топливу', zh:'燃油概览', pirate:'Grog summary' },
  'simbriefDialog.flight.blockFuel':       { de:'Blockkraftstoff', es:'Comb. bloque', fr:'Carb. bloc', it:'Carb. blocco', ja:'ブロック燃料', pl:'Paliwo blokowe', pt:'Comb. bloco', ru:'Топливо в блоках', zh:'轮挡油', pirate:'Block grog' },
  'simbriefDialog.flight.tripFuel':        { de:'Reisekraftstoff', es:'Comb. viaje', fr:'Carb. voyage', it:'Carb. viaggio', ja:'飛行燃料', pl:'Paliwo trasy', pt:'Comb. viagem', ru:'Топл. маршрута', zh:'航段油', pirate:'Voyage grog' },
  'simbriefDialog.flight.landingFuel':     { de:'Landekraftstoff', es:'Comb. aterriz.', fr:'Carb. atterriss.', it:'Carb. atterragg.', ja:'着陸時燃料', pl:'Paliwo na lądow.', pt:'Comb. aterragem', ru:'Топл. посадки', zh:'落地油', pirate:'Touchdown grog' },
  'simbriefDialog.flight.weightsSummary':  { de:'Gewichts-Übersicht', es:'Resumen pesos', fr:'Récapit. masses', it:'Riepilogo pesi', ja:'重量サマリー', pl:'Podsum. mas', pt:'Resumo pesos', ru:'Сводка по массам', zh:'重量概览', pirate:'Heft summary' },
  'simbriefDialog.flight.payload':         { de:'Nutzlast', es:'Carga útil', fr:'Charge utile', it:'Carico utile', ja:'ペイロード', pl:'Ładunek', pt:'Carga útil', ru:'Полезная нагрузка', zh:'载重', pirate:'Plunder' },
  'simbriefDialog.flight.passengers':      { de:'Passagiere', es:'Pasajeros', fr:'Passagers', it:'Passeggeri', ja:'乗客', pl:'Pasażerowie', pt:'Passageiros', ru:'Пассажиры', zh:'乘客', pirate:'Souls aboard' },
  'simbriefDialog.flight.cargo':           { de:'Fracht', es:'Carga', fr:'Fret', it:'Carico', ja:'貨物', pl:'Ładunek', pt:'Carga', ru:'Груз', zh:'货物', pirate:'Loot' },
  'simbriefDialog.flight.totalPayload':    { de:'Gesamte Nutzlast', es:'Carga útil total', fr:'Charge utile totale', it:'Carico utile totale', ja:'総ペイロード', pl:'Łącznie', pt:'Carga útil total', ru:'Общая нагрузка', zh:'总载重', pirate:'Total plunder' },
  'simbriefDialog.flight.alternate':       { de:'Ausweichflugh.', es:'Alternativo', fr:'Déroutement', it:'Alternato', ja:'代替', pl:'Zapasowe', pt:'Alternativo', ru:'Запасной', zh:'备降', pirate:'Alt port' },

  // ── simbriefDialog.weights ──────────────────────────────────────────────
  'simbriefDialog.weights.zfw':     { de:'ZFW', es:'ZFW', fr:'ZFW', it:'ZFW', ja:'ZFW', pl:'ZFW', pt:'ZFW', ru:'ZFW', zh:'ZFW', pirate:'ZFW' },
  'simbriefDialog.weights.tow':     { de:'TOW', es:'TOW', fr:'TOW', it:'TOW', ja:'TOW', pl:'TOW', pt:'TOW', ru:'TOW', zh:'TOW', pirate:'TOW' },
  'simbriefDialog.weights.ldw':     { de:'LDW', es:'LDW', fr:'LDW', it:'LDW', ja:'LDW', pl:'LDW', pt:'LDW', ru:'LDW', zh:'LDW', pirate:'LDW' },
  'simbriefDialog.weights.zfwFull': { de:'Leertankgewicht', es:'Peso sin combustible', fr:'Masse sans carburant', it:'Massa senza carburante', ja:'無燃料重量', pl:'Masa bez paliwa', pt:'Peso sem combustível', ru:'Масса без топлива', zh:'零油重', pirate:'Empty-fuel heft' },
  'simbriefDialog.weights.towFull': { de:'Startgewicht', es:'Peso al despegue', fr:'Masse au décollage', it:'Massa al decollo', ja:'離陸重量', pl:'Masa do startu', pt:'Peso à decolagem', ru:'Взлётная масса', zh:'起飞重量', pirate:'Cast-off heft' },
  'simbriefDialog.weights.ldwFull': { de:'Landegewicht', es:'Peso al aterriz.', fr:'Masse à l\'atterriss.', it:'Massa all\'atterragg.', ja:'着陸重量', pl:'Masa do lądow.', pt:'Peso à aterragem', ru:'Посадочная масса', zh:'着陆重量', pirate:'Touchdown heft' },

  // ── simbriefDialog.fuelTab ──────────────────────────────────────────────
  'simbriefDialog.fuelTab.breakdown':    { de:'Treibstoff-Aufschlüsselung', es:'Desglose combust.', fr:'Détail carburant', it:'Dettaglio carbur.', ja:'燃料内訳', pl:'Rozkład paliwa', pt:'Detalhe combust.', ru:'Разбивка топлива', zh:'燃油明细', pirate:'Grog breakdown' },
  'simbriefDialog.fuelTab.taxi':         { de:'Taxi', es:'Rodaje', fr:'Roulage', it:'Rullaggio', ja:'タクシー', pl:'Kołowanie', pt:'Táxi', ru:'Руление', zh:'滑行', pirate:'Taxi' },
  'simbriefDialog.fuelTab.trip':         { de:'Reise', es:'Viaje', fr:'Voyage', it:'Viaggio', ja:'飛行', pl:'Trasa', pt:'Viagem', ru:'Маршрут', zh:'航段', pirate:'Voyage' },
  'simbriefDialog.fuelTab.contingency':  { de:'Reserve', es:'Contingencia', fr:'Réserve route', it:'Contingenza', ja:'予備', pl:'Awaryjne', pt:'Contingência', ru:'Запасное', zh:'备用', pirate:'Just-in-case' },
  'simbriefDialog.fuelTab.alternate':    { de:'Ausweich', es:'Alternativo', fr:'Dégagement', it:'Alternato', ja:'代替', pl:'Zapasowe', pt:'Alternativo', ru:'Запасной', zh:'备降', pirate:'Alt port' },
  'simbriefDialog.fuelTab.finalReserve': { de:'Endreserve', es:'Reserva final', fr:'Réserve finale', it:'Riserva finale', ja:'最終予備', pl:'Rezerwa końc.', pt:'Reserva final', ru:'Конечный резерв', zh:'最终保留', pirate:'Last-stand reserve' },
  'simbriefDialog.fuelTab.extra':        { de:'Extra', es:'Extra', fr:'Extra', it:'Extra', ja:'追加', pl:'Dodatkowe', pt:'Extra', ru:'Доп.', zh:'额外', pirate:'Extra' },
  'simbriefDialog.fuelTab.blockFuel':    { de:'Blockkraftstoff', es:'Comb. bloque', fr:'Carb. bloc', it:'Carb. blocco', ja:'ブロック燃料', pl:'Paliwo blokowe', pt:'Comb. bloco', ru:'Топ. блок', zh:'轮挡油', pirate:'Block grog' },
  'simbriefDialog.fuelTab.takeoffFuel':  { de:'Startkraftstoff', es:'Comb. despegue', fr:'Carb. décollage', it:'Carb. decollo', ja:'離陸時燃料', pl:'Paliwo do startu', pt:'Comb. decolagem', ru:'Топл. на взлёт', zh:'起飞油', pirate:'Cast-off grog' },
  'simbriefDialog.fuelTab.landingFuel':  { de:'Landekraftstoff', es:'Comb. aterriz.', fr:'Carb. atterriss.', it:'Carb. atterragg.', ja:'着陸時燃料', pl:'Paliwo na lądow.', pt:'Comb. aterragem', ru:'Топл. посадки', zh:'落地油', pirate:'Touchdown grog' },

  // ── simbriefDialog.weightsTab ───────────────────────────────────────────
  'simbriefDialog.weightsTab.limits':     { de:'Gewichtsgrenzen', es:'Límites de peso', fr:'Limites de masse', it:'Limiti di peso', ja:'重量制限', pl:'Limity masy', pt:'Limites de peso', ru:'Пределы массы', zh:'重量限制', pirate:'Heft limits' },
  'simbriefDialog.weightsTab.operating':  { de:'Betriebsgewichte', es:'Pesos operativos', fr:'Masses opér.', it:'Pesi operativi', ja:'運用重量', pl:'Masy operacyjne', pt:'Pesos operac.', ru:'Эксплуат. массы', zh:'运行重量', pirate:'Operatin\' heft' },
  'simbriefDialog.weightsTab.oew':        { de:'OEW', es:'OEW', fr:'OEW', it:'OEW', ja:'OEW', pl:'OEW', pt:'OEW', ru:'OEW', zh:'OEW', pirate:'OEW' },
  'simbriefDialog.weightsTab.payload':    { de:'Nutzlast', es:'Carga útil', fr:'Charge utile', it:'Carico utile', ja:'ペイロード', pl:'Ładunek', pt:'Carga útil', ru:'Полезная нагрузка', zh:'载重', pirate:'Plunder' },
  'simbriefDialog.weightsTab.details':    { de:'Nutzlast-Details', es:'Detalle carga útil', fr:'Détail charge utile', it:'Dettagli carico', ja:'ペイロード詳細', pl:'Szczegóły ładunku', pt:'Detalhe carga', ru:'Детали нагрузки', zh:'载重明细', pirate:'Plunder details' },
  'simbriefDialog.weightsTab.passengers': { de:'Passagiere', es:'Pasajeros', fr:'Passagers', it:'Passeggeri', ja:'乗客', pl:'Pasażerowie', pt:'Passageiros', ru:'Пассажиры', zh:'乘客', pirate:'Souls aboard' },
  'simbriefDialog.weightsTab.cargo':      { de:'Fracht', es:'Carga', fr:'Fret', it:'Carico', ja:'貨物', pl:'Ładunek', pt:'Carga', ru:'Груз', zh:'货物', pirate:'Loot' },
  'simbriefDialog.weightsTab.paxCount':   { de:'{{count}} PAX', es:'{{count}} PAX', fr:'{{count}} PAX', it:'{{count}} PAX', ja:'{{count}} PAX', pl:'{{count}} PAX', pt:'{{count}} PAX', ru:'{{count}} PAX', zh:'{{count}} 人', pirate:'{{count}} souls' },

  // ── simbriefDialog.weather ──────────────────────────────────────────────
  'simbriefDialog.weather.alternate':     { de:'Ausweichflughafen', es:'Alternativo', fr:'Déroutement', it:'Alternato', ja:'代替', pl:'Zapasowe', pt:'Alternativo', ru:'Запасной', zh:'备降', pirate:'Alt port' },
  'simbriefDialog.weather.icaoWithLabel': { de:'{{icao}} ({{label}})', es:'{{icao}} ({{label}})', fr:'{{icao}} ({{label}})', it:'{{icao}} ({{label}})', ja:'{{icao}} ({{label}})', pl:'{{icao}} ({{label}})', pt:'{{icao}} ({{label}})', ru:'{{icao}} ({{label}})', zh:'{{icao}} ({{label}})', pirate:'{{icao}} ({{label}})' },
  'simbriefDialog.weather.windsAloft':    { de:'Mittlerer Höhenwind', es:'Vientos en altura', fr:'Vents en altitude', it:'Venti in quota', ja:'高層平均風', pl:'Wiatr na pułapie', pt:'Ventos em altitude', ru:'Средн. ветер на высоте', zh:'高空平均风', pirate:'Winds aloft' },
  'simbriefDialog.weather.direction':     { de:'Richtung', es:'Dirección', fr:'Direction', it:'Direzione', ja:'方向', pl:'Kierunek', pt:'Direção', ru:'Направление', zh:'方向', pirate:'Bearing' },
  'simbriefDialog.weather.speed':         { de:'Geschwindigkeit', es:'Velocidad', fr:'Vitesse', it:'Velocità', ja:'速度', pl:'Prędkość', pt:'Velocidade', ru:'Скорость', zh:'速度', pirate:'Speed' },
  'simbriefDialog.weather.directionDeg':  { de:'{{deg}}°', es:'{{deg}}°', fr:'{{deg}}°', it:'{{deg}}°', ja:'{{deg}}°', pl:'{{deg}}°', pt:'{{deg}}°', ru:'{{deg}}°', zh:'{{deg}}°', pirate:'{{deg}}°' },
  'simbriefDialog.weather.speedKt':       { de:'{{speed}} kt', es:'{{speed}} kt', fr:'{{speed}} kt', it:'{{speed}} kt', ja:'{{speed}} kt', pl:'{{speed}} kt', pt:'{{speed}} kt', ru:'{{speed}} kt', zh:'{{speed}} kt', pirate:'{{speed}} kt' },
  'simbriefDialog.weather.metar':         { de:'METAR', es:'METAR', fr:'METAR', it:'METAR', ja:'METAR', pl:'METAR', pt:'METAR', ru:'METAR', zh:'METAR', pirate:'METAR' },
  'simbriefDialog.weather.taf':           { de:'TAF', es:'TAF', fr:'TAF', it:'TAF', ja:'TAF', pl:'TAF', pt:'TAF', ru:'TAF', zh:'TAF', pirate:'TAF' },
  'simbriefDialog.weather.wind':          { de:'Wind', es:'Viento', fr:'Vent', it:'Vento', ja:'風', pl:'Wiatr', pt:'Vento', ru:'Ветер', zh:'风', pirate:'Wind' },
  'simbriefDialog.weather.visibility':    { de:'Sicht', es:'Visibilidad', fr:'Visibilité', it:'Visibilità', ja:'視程', pl:'Widoczność', pt:'Visibilidade', ru:'Видимость', zh:'能见度', pirate:'Spyglass range' },
  'simbriefDialog.weather.ceiling':       { de:'Wolkenuntergr.', es:'Techo', fr:'Plafond', it:'Soffitto', ja:'シーリング', pl:'Pułap chmur', pt:'Teto', ru:'Высота облач.', zh:'云底高', pirate:'Cloud ceilin\'' },
  'simbriefDialog.weather.temp':          { de:'Temp', es:'Temp', fr:'Temp', it:'Temp', ja:'気温', pl:'Temp', pt:'Temp', ru:'Темп', zh:'温度', pirate:'Temp' },
  'simbriefDialog.weather.qnh':           { de:'QNH', es:'QNH', fr:'QNH', it:'QNH', ja:'QNH', pl:'QNH', pt:'QNH', ru:'QNH', zh:'QNH', pirate:'QNH' },

  // ── simbriefDialog.performance ──────────────────────────────────────────
  'simbriefDialog.performance.vspeeds.v1':   { de:'V1', es:'V1', fr:'V1', it:'V1', ja:'V1', pl:'V1', pt:'V1', ru:'V1', zh:'V1', pirate:'V1' },
  'simbriefDialog.performance.vspeeds.vr':   { de:'VR', es:'VR', fr:'VR', it:'VR', ja:'VR', pl:'VR', pt:'VR', ru:'VR', zh:'VR', pirate:'VR' },
  'simbriefDialog.performance.vspeeds.v2':   { de:'V2', es:'V2', fr:'V2', it:'V2', ja:'V2', pl:'V2', pt:'V2', ru:'V2', zh:'V2', pirate:'V2' },
  'simbriefDialog.performance.vspeeds.vref': { de:'Vref', es:'Vref', fr:'Vref', it:'Vref', ja:'Vref', pl:'Vref', pt:'Vref', ru:'Vref', zh:'Vref', pirate:'Vref' },
  'simbriefDialog.performance.flexTemp':     { de:'Flex-Temp', es:'Temp Flex', fr:'Temp Flex', it:'Temp Flex', ja:'フレックス気温', pl:'Temp Flex', pt:'Temp Flex', ru:'Темп Flex', zh:'减推力温度', pirate:'Flex temp' },
  'simbriefDialog.performance.togaThrust':   { de:'TOGA', es:'TOGA', fr:'TOGA', it:'TOGA', ja:'TOGA', pl:'TOGA', pt:'TOGA', ru:'TOGA', zh:'TOGA', pirate:'TOGA' },
  'simbriefDialog.performance.wind':         { de:'Wind', es:'Viento', fr:'Vent', it:'Vento', ja:'風', pl:'Wiatr', pt:'Vento', ru:'Ветер', zh:'风', pirate:'Wind' },
  'simbriefDialog.performance.flaps':        { de:'Klappen', es:'Flaps', fr:'Volets', it:'Flap', ja:'フラップ', pl:'Klapy', pt:'Flaps', ru:'Закрылки', zh:'襟翼', pirate:'Flaps' },
  'simbriefDialog.performance.thrust':       { de:'Schub', es:'Empuje', fr:'Poussée', it:'Spinta', ja:'推力', pl:'Ciąg', pt:'Empuxo', ru:'Тяга', zh:'推力', pirate:'Thrust' },
  'simbriefDialog.performance.rwyLength':    { de:'Pistenlänge', es:'Long. pista', fr:'Long. piste', it:'Lung. pista', ja:'滑走路長', pl:'Długość pasa', pt:'Compr. pista', ru:'Длина ВПП', zh:'跑道长度', pirate:'Strip length' },
  'simbriefDialog.performance.meters':       { de:'{{value}} m', es:'{{value}} m', fr:'{{value}} m', it:'{{value}} m', ja:'{{value}} m', pl:'{{value}} m', pt:'{{value}} m', ru:'{{value}} м', zh:'{{value}} 米', pirate:'{{value}} m' },
  'simbriefDialog.performance.feet':         { de:'{{value}} ft', es:'{{value}} ft', fr:'{{value}} ft', it:'{{value}} ft', ja:'{{value}} ft', pl:'{{value}} ft', pt:'{{value}} ft', ru:'{{value}} ft', zh:'{{value}} ft', pirate:'{{value}} ft' },
  'simbriefDialog.performance.tlrNotAvailable':{ de:'TLR-Daten nicht verfügbar', es:'Datos TLR no disponibles', fr:'Données TLR indisponibles', it:'Dati TLR non disponibili', ja:'TLRデータなし', pl:'Brak danych TLR', pt:'Dados TLR indisponíveis', ru:'Нет данных TLR', zh:'无 TLR 数据', pirate:'TLR scrolls missin\'' },
  'simbriefDialog.performance.ldaDry':       { de:'LDA (trocken)', es:'LDA (seca)', fr:'LDA (sèche)', it:'LDA (asciutta)', ja:'LDA(乾)', pl:'LDA (sucha)', pt:'LDA (seca)', ru:'LDA (сухая)', zh:'LDA (干)', pirate:'LDA (dry)' },
  'simbriefDialog.performance.ldaWet':       { de:'LDA (nass)', es:'LDA (mojada)', fr:'LDA (mouillée)', it:'LDA (bagnata)', ja:'LDA(濡)', pl:'LDA (mokra)', pt:'LDA (molhada)', ru:'LDA (мокрая)', zh:'LDA (湿)', pirate:'LDA (wet)' },
  'simbriefDialog.performance.cruise':       { de:'Reiseflug-Leistung', es:'Rendim. crucero', fr:'Perf. croisière', it:'Prest. crociera', ja:'巡航性能', pl:'Osiągi przelotu', pt:'Desemp. cruzeiro', ru:'Хар-ки крейсера', zh:'巡航性能', pirate:'Cruise perf' },
  'simbriefDialog.performance.initialFl':    { de:'Anfangs-FL', es:'FL inicial', fr:'FL initial', it:'FL iniziale', ja:'初期FL', pl:'Pocz. FL', pt:'FL inicial', ru:'Нач. FL', zh:'初始 FL', pirate:'Start FL' },
  'simbriefDialog.performance.costIndex':    { de:'Cost Index', es:'Cost Index', fr:'Cost Index', it:'Cost Index', ja:'コストインデックス', pl:'Cost Index', pt:'Cost Index', ru:'Cost Index', zh:'成本指数', pirate:'Cost Index' },
  'simbriefDialog.performance.cruiseMach':   { de:'Reise-Mach', es:'Mach crucero', fr:'Mach croisière', it:'Mach crociera', ja:'巡航マッハ', pl:'Mach przelotu', pt:'Mach cruzeiro', ru:'Крейсер. Mach', zh:'巡航马赫', pirate:'Cruise Mach' },
  'simbriefDialog.performance.machValue':    { de:'M{{mach}}', es:'M{{mach}}', fr:'M{{mach}}', it:'M{{mach}}', ja:'M{{mach}}', pl:'M{{mach}}', pt:'M{{mach}}', ru:'M{{mach}}', zh:'M{{mach}}', pirate:'M{{mach}}' },
  'simbriefDialog.performance.cruiseTas':    { de:'Reise-TAS', es:'TAS crucero', fr:'VV croisière', it:'TAS crociera', ja:'巡航TAS', pl:'TAS przelotu', pt:'TAS cruzeiro', ru:'Крейсер. TAS', zh:'巡航 TAS', pirate:'Cruise TAS' },
  'simbriefDialog.performance.tasKt':        { de:'{{tas}} kt', es:'{{tas}} kt', fr:'{{tas}} kt', it:'{{tas}} kt', ja:'{{tas}} kt', pl:'{{tas}} kt', pt:'{{tas}} kt', ru:'{{tas}} kt', zh:'{{tas}} kt', pirate:'{{tas}} kt' },
  'simbriefDialog.performance.stepClimbs':   { de:'Stufensteigflüge', es:'Ascensos por escalón', fr:'Montées par paliers', it:'Salite a gradini', ja:'ステップ上昇', pl:'Wznoszenie stopniowe', pt:'Subidas escalonadas', ru:'Ступенч. набор', zh:'阶梯爬升', pirate:'Step climbs' },
  'simbriefDialog.performance.stepFallback': { de:'Stufe {{n}}', es:'Escalón {{n}}', fr:'Palier {{n}}', it:'Gradino {{n}}', ja:'ステップ {{n}}', pl:'Stopień {{n}}', pt:'Escalão {{n}}', ru:'Ступень {{n}}', zh:'阶 {{n}}', pirate:'Step {{n}}' },
  'simbriefDialog.performance.stepLabel':    { de:'{{altitude}} @ {{waypoint}}', es:'{{altitude}} @ {{waypoint}}', fr:'{{altitude}} @ {{waypoint}}', it:'{{altitude}} @ {{waypoint}}', ja:'{{altitude}} @ {{waypoint}}', pl:'{{altitude}} @ {{waypoint}}', pt:'{{altitude}} @ {{waypoint}}', ru:'{{altitude}} @ {{waypoint}}', zh:'{{altitude}} @ {{waypoint}}', pirate:'{{altitude}} @ {{waypoint}}' },
  'simbriefDialog.performance.transAltOrigin':{ de:'{{icao}} Übergangshöhe', es:'{{icao}} Alt. transición', fr:'{{icao}} Alt. transition', it:'{{icao}} Alt. transizione', ja:'{{icao}} 遷移高度', pl:'{{icao}} Wys. przejścia', pt:'{{icao}} Alt. transição', ru:'{{icao}} Высота перехода', zh:'{{icao}} 过渡高度', pirate:'{{icao}} cross-over alt' },
  'simbriefDialog.performance.transLevelDest':{ de:'{{icao}} Übergangsfläche', es:'{{icao}} Nivel transición', fr:'{{icao}} Niveau transition', it:'{{icao}} Liv. transizione', ja:'{{icao}} 遷移高度', pl:'{{icao}} Poz. przejścia', pt:'{{icao}} Nível transição', ru:'{{icao}} Эшелон перехода', zh:'{{icao}} 过渡高度层', pirate:'{{icao}} cross-over level' },
  'simbriefDialog.performance.flightLevel':  { de:'FL{{value}}', es:'FL{{value}}', fr:'FL{{value}}', it:'FL{{value}}', ja:'FL{{value}}', pl:'FL{{value}}', pt:'FL{{value}}', ru:'FL{{value}}', zh:'FL{{value}}', pirate:'FL{{value}}' },
  'simbriefDialog.performance.windDirSpeed': { de:'{{dir}}°/{{speed}}kt', es:'{{dir}}°/{{speed}}kt', fr:'{{dir}}°/{{speed}}kt', it:'{{dir}}°/{{speed}}kt', ja:'{{dir}}°/{{speed}}kt', pl:'{{dir}}°/{{speed}}kt', pt:'{{dir}}°/{{speed}}kt', ru:'{{dir}}°/{{speed}}kt', zh:'{{dir}}°/{{speed}}kt', pirate:'{{dir}}°/{{speed}}kt' },

  // ── simbriefDialog.profile ──────────────────────────────────────────────
  'simbriefDialog.profile.noData':      { de:'Keine Profildaten verfügbar', es:'Sin datos de perfil', fr:'Aucune donnée de profil', it:'Nessun dato di profilo', ja:'プロファイルデータなし', pl:'Brak danych profilu', pt:'Sem dados de perfil', ru:'Нет данных профиля', zh:'无剖面数据', pirate:'No profile scroll' },
  'simbriefDialog.profile.altitude':    { de:'Höhe', es:'Altitud', fr:'Altitude', it:'Altitudine', ja:'高度', pl:'Wysokość', pt:'Altitude', ru:'Высота', zh:'高度', pirate:'Altitude' },
  'simbriefDialog.profile.distance':    { de:'Entfernung', es:'Distancia', fr:'Distance', it:'Distanza', ja:'距離', pl:'Odległość', pt:'Distância', ru:'Расстояние', zh:'距离', pirate:'Distance' },
  'simbriefDialog.profile.wind':        { de:'Wind', es:'Viento', fr:'Vent', it:'Vento', ja:'風', pl:'Wiatr', pt:'Vento', ru:'Ветер', zh:'风', pirate:'Wind' },
  'simbriefDialog.profile.terrain':     { de:'Terrain', es:'Terreno', fr:'Terrain', it:'Terreno', ja:'地形', pl:'Teren', pt:'Terreno', ru:'Местность', zh:'地形', pirate:'Land' },
  'simbriefDialog.profile.flightPath':  { de:'Flugweg', es:'Trayectoria', fr:'Trajectoire', it:'Traiettoria', ja:'飛行経路', pl:'Tor lotu', pt:'Trajetória', ru:'Траектория', zh:'飞行轨迹', pirate:'Voyage track' },
  'simbriefDialog.profile.tocBadge':    { de:'T/C', es:'T/C', fr:'T/C', it:'T/C', ja:'T/C', pl:'T/C', pt:'T/C', ru:'T/C', zh:'T/C', pirate:'T/C' },
  'simbriefDialog.profile.todBadge':    { de:'T/D', es:'T/D', fr:'T/D', it:'T/D', ja:'T/D', pl:'T/D', pt:'T/D', ru:'T/D', zh:'T/D', pirate:'T/D' },
  'simbriefDialog.profile.total':       { de:'Gesamt:', es:'Total:', fr:'Total :', it:'Totale:', ja:'合計:', pl:'Razem:', pt:'Total:', ru:'Итого:', zh:'总计:', pirate:'Grand sum:' },
  'simbriefDialog.profile.distanceNm':  { de:'{{value}} NM', es:'{{value}} NM', fr:'{{value}} NM', it:'{{value}} NM', ja:'{{value}} NM', pl:'{{value}} NM', pt:'{{value}} NM', ru:'{{value}} NM', zh:'{{value}} NM', pirate:'{{value}} NM' },
  'simbriefDialog.profile.altitudeFt':  { de:'{{value}} ft', es:'{{value}} ft', fr:'{{value}} ft', it:'{{value}} ft', ja:'{{value}} ft', pl:'{{value}} ft', pt:'{{value}} ft', ru:'{{value}} ft', zh:'{{value}} ft', pirate:'{{value}} ft' },

  // ── simbriefDialog.navlog ───────────────────────────────────────────────
  'simbriefDialog.navlog.colFix':         { de:'Fix / Airway', es:'Fijo / Aerovía', fr:'Point / Voie', it:'Fix / Aerovia', ja:'フィックス / 航路', pl:'Punkt / Droga', pt:'Fixo / Aerovia', ru:'Точка / Трасса', zh:'航点 / 航路', pirate:'Mark / Highway' },
  'simbriefDialog.navlog.colAltitude':    { de:'Höhe', es:'Altitud', fr:'Altitude', it:'Altitudine', ja:'高度', pl:'Wysokość', pt:'Altitude', ru:'Высота', zh:'高度', pirate:'Altitude' },
  'simbriefDialog.navlog.colWind':        { de:'Wind', es:'Viento', fr:'Vent', it:'Vento', ja:'風', pl:'Wiatr', pt:'Vento', ru:'Ветер', zh:'风', pirate:'Wind' },
  'simbriefDialog.navlog.colGsMach':      { de:'GS / Mach', es:'GS / Mach', fr:'GS / Mach', it:'GS / Mach', ja:'GS / マッハ', pl:'GS / Mach', pt:'GS / Mach', ru:'GS / Mach', zh:'GS / 马赫', pirate:'GS / Mach' },
  'simbriefDialog.navlog.colEta':         { de:'ETA', es:'ETA', fr:'ETA', it:'ETA', ja:'ETA', pl:'ETA', pt:'ETA', ru:'ETA', zh:'ETA', pirate:'ETA' },
  'simbriefDialog.navlog.colFuelRem':     { de:'Treibst. übrig', es:'Comb. rest.', fr:'Carb. rest.', it:'Carb. rim.', ja:'残燃料', pl:'Paliwo rezerw.', pt:'Comb. rest.', ru:'Топл. остаток', zh:'剩余油', pirate:'Grog left' },
  'simbriefDialog.navlog.waypointCount':  { de:'{{count}} Wegpunkte', es:'{{count}} puntos', fr:'{{count}} points', it:'{{count}} waypoint', ja:'{{count}} ウェイポイント', pl:'{{count}} punktów', pt:'{{count}} pontos', ru:'{{count}} точек', zh:'{{count}} 航点', pirate:'{{count}} marks' },
  'simbriefDialog.navlog.groundSpeedKt':  { de:'{{value}} kt', es:'{{value}} kt', fr:'{{value}} kt', it:'{{value}} kt', ja:'{{value}} kt', pl:'{{value}} kt', pt:'{{value}} kt', ru:'{{value}} kt', zh:'{{value}} kt', pirate:'{{value}} kt' },
  'simbriefDialog.navlog.position':       { de:'Position', es:'Posición', fr:'Position', it:'Posizione', ja:'位置', pl:'Pozycja', pt:'Posição', ru:'Позиция', zh:'位置', pirate:'Position' },
  'simbriefDialog.navlog.temperature':    { de:'Temperatur', es:'Temperatura', fr:'Température', it:'Temperatura', ja:'気温', pl:'Temperatura', pt:'Temperatura', ru:'Температура', zh:'温度', pirate:'Temp' },
  'simbriefDialog.navlog.oatWithIsa':     { de:'{{oat}}°C (ISA{{sign}}{{dev}})', es:'{{oat}}°C (ISA{{sign}}{{dev}})', fr:'{{oat}}°C (ISA{{sign}}{{dev}})', it:'{{oat}}°C (ISA{{sign}}{{dev}})', ja:'{{oat}}°C (ISA{{sign}}{{dev}})', pl:'{{oat}}°C (ISA{{sign}}{{dev}})', pt:'{{oat}}°C (ISA{{sign}}{{dev}})', ru:'{{oat}}°C (ISA{{sign}}{{dev}})', zh:'{{oat}}°C (ISA{{sign}}{{dev}})', pirate:'{{oat}}°C (ISA{{sign}}{{dev}})' },
  'simbriefDialog.navlog.windComponent':  { de:'Windkomponente', es:'Comp. de viento', fr:'Composante vent', it:'Comp. vento', ja:'風成分', pl:'Składowa wiatru', pt:'Comp. de vento', ru:'Сост. ветра', zh:'风分量', pirate:'Wind component' },
  'simbriefDialog.navlog.windCompValue':  { de:'{{value}} kt {{tag}}', es:'{{value}} kt {{tag}}', fr:'{{value}} kt {{tag}}', it:'{{value}} kt {{tag}}', ja:'{{value}} kt {{tag}}', pl:'{{value}} kt {{tag}}', pt:'{{value}} kt {{tag}}', ru:'{{value}} kt {{tag}}', zh:'{{value}} kt {{tag}}', pirate:'{{value}} kt {{tag}}' },
  'simbriefDialog.navlog.headwind':       { de:'(Gegenwind)', es:'(viento de frente)', fr:'(vent debout)', it:'(vento contrario)', ja:'(向かい風)', pl:'(czoło)', pt:'(vento de frente)', ru:'(встречный)', zh:'(逆风)', pirate:'(headwind, arr)' },
  'simbriefDialog.navlog.tailwind':       { de:'(Rückenwind)', es:'(viento de cola)', fr:'(vent arrière)', it:'(vento in coda)', ja:'(追い風)', pl:'(z tyłu)', pt:'(vento de cauda)', ru:'(попутный)', zh:'(顺风)', pirate:'(tailwind, yarr)' },
  'simbriefDialog.navlog.tropopause':     { de:'Tropopause', es:'Tropopausa', fr:'Tropopause', it:'Tropopausa', ja:'圏界面', pl:'Tropopauza', pt:'Tropopausa', ru:'Тропопауза', zh:'对流层顶', pirate:'Tropopause' },
  'simbriefDialog.navlog.fir':            { de:'FIR', es:'FIR', fr:'FIR', it:'FIR', ja:'FIR', pl:'FIR', pt:'FIR', ru:'FIR', zh:'FIR', pirate:'FIR' },
  'simbriefDialog.navlog.groundElevation':{ de:'Geländehöhe', es:'Elev. terreno', fr:'Élév. terrain', it:'Elev. terreno', ja:'地表標高', pl:'Wys. terenu', pt:'Elev. terreno', ru:'Высота местн.', zh:'地面高度', pirate:'Land height' },
  'simbriefDialog.navlog.mora':           { de:'MORA', es:'MORA', fr:'MORA', it:'MORA', ja:'MORA', pl:'MORA', pt:'MORA', ru:'MORA', zh:'MORA', pirate:'MORA' },
  'simbriefDialog.navlog.fuelUsed':       { de:'Treibstoff verbraucht', es:'Comb. usado', fr:'Carb. utilisé', it:'Carb. usato', ja:'使用燃料', pl:'Zużyte paliwo', pt:'Comb. usado', ru:'Расход топлива', zh:'已用油', pirate:'Grog burnt' },
  'simbriefDialog.navlog.fuelUsedValue':  { de:'{{value}} {{unit}}', es:'{{value}} {{unit}}', fr:'{{value}} {{unit}}', it:'{{value}} {{unit}}', ja:'{{value}} {{unit}}', pl:'{{value}} {{unit}}', pt:'{{value}} {{unit}}', ru:'{{value}} {{unit}}', zh:'{{value}} {{unit}}', pirate:'{{value}} {{unit}}' },

  // ── simbriefDialog.briefing ─────────────────────────────────────────────
  'simbriefDialog.briefing.notamLabelDeparture': { de:'Abflug', es:'Salida', fr:'Départ', it:'Partenza', ja:'出発', pl:'Wylot', pt:'Partida', ru:'Вылет', zh:'出发', pirate:'Cast-off' },
  'simbriefDialog.briefing.notamLabelArrival':   { de:'Ankunft', es:'Llegada', fr:'Arrivée', it:'Arrivo', ja:'到着', pl:'Przylot', pt:'Chegada', ru:'Прибытие', zh:'到达', pirate:'Touchdown' },
  'simbriefDialog.briefing.notamLabelAlternate': { de:'Ausweich', es:'Alternativo', fr:'Déroutement', it:'Alternato', ja:'代替', pl:'Zapasowe', pt:'Alternativo', ru:'Запасной', zh:'备降', pirate:'Alt port' },
  'simbriefDialog.briefing.transAltAbbr':        { de:'TA: {{value}} ft', es:'TA: {{value}} ft', fr:'TA: {{value}} ft', it:'TA: {{value}} ft', ja:'TA: {{value}} ft', pl:'TA: {{value}} ft', pt:'TA: {{value}} ft', ru:'TA: {{value}} ft', zh:'TA: {{value}} ft', pirate:'TA: {{value}} ft' },
  'simbriefDialog.briefing.transLevelAbbr':      { de:'TL: FL{{value}}', es:'TL: FL{{value}}', fr:'TL: FL{{value}}', it:'TL: FL{{value}}', ja:'TL: FL{{value}}', pl:'TL: FL{{value}}', pt:'TL: FL{{value}}', ru:'TL: FL{{value}}', zh:'TL: FL{{value}}', pirate:'TL: FL{{value}}' },
  'simbriefDialog.briefing.sigmetValid':         { de:'Gültig: {{start}} - {{end}}', es:'Válido: {{start}} - {{end}}', fr:'Valide : {{start}} - {{end}}', it:'Valido: {{start}} - {{end}}', ja:'有効: {{start}} - {{end}}', pl:'Ważne: {{start}} - {{end}}', pt:'Válido: {{start}} - {{end}}', ru:'Действ.: {{start}} - {{end}}', zh:'有效期: {{start}} - {{end}}', pirate:'Valid: {{start}} - {{end}}' },
  'simbriefDialog.briefing.sigmetFir':           { de:'FIR: {{name}}', es:'FIR: {{name}}', fr:'FIR : {{name}}', it:'FIR: {{name}}', ja:'FIR: {{name}}', pl:'FIR: {{name}}', pt:'FIR: {{name}}', ru:'FIR: {{name}}', zh:'FIR: {{name}}', pirate:'FIR: {{name}}' },
  'simbriefDialog.briefing.notamCount_one':      { de:'1 NOTAM', es:'1 NOTAM', fr:'1 NOTAM', it:'1 NOTAM', ja:'NOTAM 1', pl:'1 NOTAM', pt:'1 NOTAM', ru:'1 NOTAM', zh:'1 个 NOTAM', pirate:'1 NOTAM' },
  'simbriefDialog.briefing.notamCount_other':    { de:'{{count}} NOTAMs', es:'{{count}} NOTAMs', fr:'{{count}} NOTAMs', it:'{{count}} NOTAM', ja:'NOTAM {{count}}', pl:'{{count}} NOTAM-ów', pt:'{{count}} NOTAMs', ru:'{{count}} NOTAM', zh:'{{count}} 个 NOTAM', pirate:'{{count}} NOTAMs' },
  'simbriefDialog.briefing.showMore':            { de:'Mehr anzeigen', es:'Mostrar más', fr:'Voir plus', it:'Mostra altro', ja:'もっと見る', pl:'Pokaż więcej', pt:'Mostrar mais', ru:'Показать ещё', zh:'显示更多', pirate:'Show more' },
  'simbriefDialog.briefing.showLess':            { de:'Weniger anzeigen', es:'Mostrar menos', fr:'Voir moins', it:'Mostra meno', ja:'閉じる', pl:'Pokaż mniej', pt:'Mostrar menos', ru:'Скрыть', zh:'收起', pirate:'Show less' },
  'simbriefDialog.briefing.notamEffective':      { de:'Gültig ab: {{date}}', es:'Vigente: {{date}}', fr:'Effectif : {{date}}', it:'In vigore: {{date}}', ja:'発効: {{date}}', pl:'Obowiązuje od: {{date}}', pt:'Em vigor: {{date}}', ru:'Действует: {{date}}', zh:'生效: {{date}}', pirate:'In effect: {{date}}' },
  'simbriefDialog.briefing.notamEffectiveRange': { de:'Gültig: {{start}} - {{end}}', es:'Vigente: {{start}} - {{end}}', fr:'Effectif : {{start}} - {{end}}', it:'In vigore: {{start}} - {{end}}', ja:'有効: {{start}} - {{end}}', pl:'Obowiązuje: {{start}} - {{end}}', pt:'Em vigor: {{start}} - {{end}}', ru:'Действует: {{start}} - {{end}}', zh:'有效期: {{start}} - {{end}}', pirate:'In effect: {{start}} - {{end}}' },
};

// ─── Apply ────────────────────────────────────────────────────────────────

function setByPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
    if (cur === undefined) return false;
  }
  cur[parts[parts.length - 1]] = value;
  return true;
}

const stats = Object.fromEntries(LOCALES.map((l) => [l, { applied: 0, missing: 0 }]));

for (const loc of LOCALES) {
  const file = path.join(LOCALES_DIR, `${loc}.json`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  for (const [keyPath, perLocale] of Object.entries(T)) {
    const tx = perLocale[loc];
    if (tx === undefined) {
      stats[loc].missing += 1;
      continue;
    }
    if (setByPath(data, keyPath, tx)) stats[loc].applied += 1;
    else stats[loc].missing += 1;
  }
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

console.log('\nTranslations applied:');
for (const [loc, s] of Object.entries(stats)) {
  console.log(`  ${loc.padEnd(8)} +${s.applied} applied${s.missing ? `, ${s.missing} missing` : ''}`);
}
console.log(`\nTotal keys in map: ${Object.keys(T).length}`);
