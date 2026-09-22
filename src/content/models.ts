// Redactionele info per model voor de modelpagina's. Bewust kort en algemeen gehouden:
// cijfers (motoren, vermogen, prijzen) komen uit de actuele data, niet uit deze tekst.
// ✏️ Vrij aan te passen of aan te vullen.

export interface ModelContent {
  /** Eén zin: wat voor wagen is het? */
  tagline: string;
  /** Korte introductie (1–2 alinea's) */
  intro: string[];
  /** Waar let je op bij aankoop? */
  tips: string[];
  body?: string;
  /** Eerdere naam, voor wie op de oude naam zoekt */
  formerly?: string;
}

const EV_TIPS = [
  "Kijk naar de batterijgarantie en vraag bij een tweedehandse wagen naar de batterijstatus (State of Health).",
  "Controleer of er een warmtepomp aanwezig is: die helpt het rijbereik in de winter.",
  "Vergelijk het rijbereik (WLTP) met je dagelijkse ritten en laadmogelijkheden thuis of op het werk.",
];

const PHEV_TIPS = [
  "Een plug-in hybride is vooral voordelig als je vaak elektrisch rijdt en thuis of op het werk kan laden.",
  "Kijk naar het elektrische rijbereik: oudere versies halen merkbaar minder dan de nieuwste T6/T8-motoren.",
];

const USED_TIPS = [
  "Vraag het onderhoudsboekje en (in België) het Car-Pass-rapport met de kilometerhistoriek.",
  "Bij Volvo Selekt krijg je een gecontroleerde wagen met garantie van de verdeler.",
];

export const MODEL_CONTENT: Record<string, ModelContent> = {
  EX30: {
    tagline: "Volvo's kleinste elektrische SUV",
    body: "Compacte SUV",
    intro: [
      "De EX30 is de instapper in het elektrische gamma van Volvo: compact, wendbaar in de stad en rijkelijk uitgerust voor zijn formaat.",
      "Er zijn versies met één motor (achterwielaandrijving) en een krachtige Twin Motor Performance met vierwielaandrijving.",
    ],
    tips: [...EV_TIPS, "De achterbank en koffer zijn eerder klein: ideaal als stadswagen of tweede wagen."],
  },
  EX40: {
    tagline: "Compacte elektrische SUV",
    body: "Compacte SUV",
    formerly: "XC40 Recharge Pure Electric",
    intro: [
      "De EX40 is de volledig elektrische versie van de populaire XC40. Tot 2024 heette hij XC40 Recharge Pure Electric.",
      "Hij combineert de praktische maten van de XC40 met stille, elektrische aandrijving.",
    ],
    tips: [...EV_TIPS, "Zoek je een oudere versie, zoek dan ook op de oude naam XC40 Recharge."],
  },
  EC40: {
    tagline: "Elektrische coupé-SUV",
    body: "Coupé-SUV",
    formerly: "C40 Recharge",
    intro: [
      "De EC40 is de coupé-versie van de EX40, met een aflopende daklijn. Tot 2024 heette hij C40 Recharge.",
      "Technisch is hij grotendeels gelijk aan de EX40; het verschil zit vooral in het design en iets minder hoofdruimte achteraan.",
    ],
    tips: [...EV_TIPS, "Oudere exemplaren staan te koop als C40: vergelijk beide namen."],
  },
  C40: {
    tagline: "Elektrische coupé-SUV (nu EC40)",
    body: "Coupé-SUV",
    intro: ["De C40 Recharge is de vorige naam van de EC40: een elektrische coupé-SUV op basis van de XC40."],
    tips: [...EV_TIPS, ...USED_TIPS],
  },
  EX60: {
    tagline: "Elektrische middelgrote SUV",
    body: "Middelgrote SUV",
    intro: ["De EX60 is Volvo's elektrische SUV in het middensegment, qua formaat vergelijkbaar met de XC60."],
    tips: EV_TIPS,
  },
  EX90: {
    tagline: "Grote elektrische SUV met zeven zitplaatsen",
    body: "Grote SUV",
    intro: [
      "De EX90 is het elektrische vlaggenschip van Volvo: een ruime SUV met zeven zitplaatsen en veel veiligheidstechnologie.",
    ],
    tips: [...EV_TIPS, "Controleer of de software up-to-date is: Volvo levert voor de EX90 regelmatig updates."],
  },
  ES90: {
    tagline: "Elektrische luxesedan",
    body: "Sedan / fastback",
    intro: ["De ES90 is een ruime elektrische sedan met een fastback-achterklep, bedoeld voor lange afstanden in comfort."],
    tips: EV_TIPS,
  },
  XC40: {
    tagline: "Compacte SUV, de bestseller in de stad",
    body: "Compacte SUV",
    intro: [
      "De XC40 is een compacte SUV met een hoge zitpositie en slimme opbergruimte. Recente versies rijden als mild hybride (B3, B4).",
      "Oudere exemplaren zijn er ook als benzine (T2, T3, T4, T5), diesel of plug-in hybride.",
    ],
    tips: [...USED_TIPS, "Let bij oudere versies op het verschil tussen manuele en automatische versnellingsbak."],
  },
  XC60: {
    tagline: "Middelgrote SUV, Volvo's populairste model",
    body: "Middelgrote SUV",
    intro: [
      "De XC60 is de populairste Volvo: ruim genoeg voor een gezin, comfortabel op lange ritten. Je vindt hem vooral als plug-in hybride (T6, T8) en mild hybride (B4, B5).",
    ],
    tips: [...PHEV_TIPS, ...USED_TIPS],
  },
  XC90: {
    tagline: "Grote SUV met zeven zitplaatsen",
    body: "Grote SUV",
    intro: [
      "De XC90 is de grote SUV van Volvo met zeven zitplaatsen. Recente versies zijn vooral plug-in hybrides (T8).",
    ],
    tips: [...PHEV_TIPS, ...USED_TIPS, "Controleer of de derde zitrij aanwezig is als je die nodig hebt."],
  },
  V60: {
    tagline: "Middelgrote break",
    body: "Break",
    intro: ["De V60 is een elegante break met veel kofferruimte, als mild hybride of plug-in hybride."],
    tips: [...PHEV_TIPS, ...USED_TIPS],
  },
  "V60 Cross Country": {
    tagline: "Verhoogde break met vierwielaandrijving",
    body: "Break",
    intro: ["De V60 Cross Country is een V60 met meer bodemvrijheid en robuustere look, ideaal voor slechte wegen of een caravan."],
    tips: USED_TIPS,
  },
  V90: {
    tagline: "Grote break",
    body: "Break",
    intro: ["De V90 is de grote break van Volvo: veel ruimte en comfort voor lange afstanden."],
    tips: [...PHEV_TIPS, ...USED_TIPS],
  },
  "V90 Cross Country": {
    tagline: "Grote verhoogde break",
    body: "Break",
    intro: ["De V90 Cross Country combineert de ruimte van de V90 met meer bodemvrijheid en vierwielaandrijving."],
    tips: USED_TIPS,
  },
  S60: {
    tagline: "Middelgrote sedan",
    body: "Sedan",
    intro: ["De S60 is de sportieve sedan van Volvo. Je vindt hem vooral nog tweedehands."],
    tips: USED_TIPS,
  },
  S90: {
    tagline: "Grote luxesedan",
    body: "Sedan",
    intro: ["De S90 is de grote, comfortabele sedan van Volvo. Je vindt hem vooral nog tweedehands."],
    tips: USED_TIPS,
  },
  V40: {
    tagline: "Compacte hatchback",
    body: "Hatchback",
    intro: ["De V40 is een compacte vijfdeurs hatchback die niet meer nieuw verkocht wordt: een betaalbare instap in een tweedehandse Volvo."],
    tips: USED_TIPS,
  },
};

export const DEFAULT_CONTENT: ModelContent = {
  tagline: "Volvo",
  intro: [],
  tips: USED_TIPS,
};
