// Static import map to avoid dynamic import warnings in bundlers
import AR, { AR_WORDS } from './ar';
import CS, { CS_WORDS } from './cs';
import DA, { DA_WORDS } from './da';
import DE, { DE_WORDS } from './de';
import EN, { EN_WORDS } from './en';
import EO, { EO_WORDS } from './eo';
import ES, { ES_WORDS } from './es';
import FA, { FA_WORDS } from './fa';
import FI, { FI_WORDS } from './fi';
import FR, { FR_WORDS } from './fr';
import HI, { HI_WORDS } from './hi';
import HU, { HU_WORDS } from './hu';
import IT, { IT_WORDS } from './it';
import JA, { JA_WORDS } from './ja';
import KO, { KO_WORDS } from './ko';
import NL, { NL_WORDS } from './nl';
import NO, { NO_WORDS } from './no';
import PL, { PL_WORDS } from './pl';
import PT, { PT_WORDS } from './pt';
import RU, { RU_WORDS } from './ru';
import SV, { SV_WORDS } from './sv';
import TH, { TH_WORDS } from './th';
import TLH, { TLH_WORDS } from './tlh';
import TR, { TR_WORDS } from './tr';
import ZH, { ZH_WORDS } from './zh';

export const languageWordMap: Record<string, string[]> = {
  ar: AR_WORDS ?? AR,
  cs: CS_WORDS ?? CS,
  da: DA_WORDS ?? DA,
  de: DE_WORDS ?? DE,
  en: EN_WORDS ?? EN,
  eo: EO_WORDS ?? EO,
  es: ES_WORDS ?? ES,
  fa: FA_WORDS ?? FA,
  fi: FI_WORDS ?? FI,
  fr: FR_WORDS ?? FR,
  hi: HI_WORDS ?? HI,
  hu: HU_WORDS ?? HU,
  it: IT_WORDS ?? IT,
  ja: JA_WORDS ?? JA,
  ko: KO_WORDS ?? KO,
  nl: NL_WORDS ?? NL,
  no: NO_WORDS ?? NO,
  pl: PL_WORDS ?? PL,
  pt: PT_WORDS ?? PT,
  ru: RU_WORDS ?? RU,
  sv: SV_WORDS ?? SV,
  th: TH_WORDS ?? TH,
  tlh: TLH_WORDS ?? TLH,
  tr: TR_WORDS ?? TR,
  zh: ZH_WORDS ?? ZH,
};

export const allLanguageCodes: string[] = Object.keys(languageWordMap);
