import { parseNationId } from "../../../shared/ids";
import type { ScenarioInitialUnitDefinition } from "../registry";

const unit = (
  id: string,
  nationId: string,
  provinceId: string,
  manpower: number,
): ScenarioInitialUnitDefinition =>
  Object.freeze({ id, nationId: parseNationId(nationId), provinceId, manpower });

export const eastAsiaInitialUnits: readonly ScenarioInitialUnitDefinition[] = Object.freeze([
  unit("unt_ea1900_jpn_1", "nat_jpn", "prv_jpn_hokkaido", 45_000),
  unit("unt_ea1900_jpn_2", "nat_jpn", "prv_jpn_tohoku", 55_000),
  unit("unt_ea1900_jpn_3", "nat_jpn", "prv_jpn_kanto", 70_000),
  unit("unt_ea1900_jpn_4", "nat_jpn", "prv_jpn_kansai", 60_000),
  unit("unt_ea1900_jpn_5", "nat_jpn", "prv_jpn_chugoku_shikoku", 50_000),
  unit("unt_ea1900_jpn_6", "nat_jpn", "prv_jpn_kyushu", 55_000),
  unit("unt_ea1900_rus_1", "nat_rus", "prv_rus_primorye", 35_000),
  unit("unt_ea1900_rus_2", "nat_rus", "prv_rus_amur", 30_000),
  unit("unt_ea1900_rus_3", "nat_rus", "prv_rus_transbaikal", 40_000),
  unit("unt_ea1900_qing_1", "nat_qing", "prv_qing_zhili", 60_000),
  unit("unt_ea1900_qing_2", "nat_qing", "prv_qing_manchuria", 55_000),
  unit("unt_ea1900_qing_3", "nat_qing", "prv_qing_shandong", 45_000),
  unit("unt_ea1900_qing_4", "nat_qing", "prv_qing_jiangnan", 50_000),
  unit("unt_ea1900_kor_1", "nat_kor", "prv_kor_hanseong", 25_000),
  unit("unt_ea1900_kor_2", "nat_kor", "prv_kor_hamgyeong", 18_000),
  unit("unt_ea1900_gbr_1", "nat_gbr", "prv_gbr_hongkong", 12_000),
  unit("unt_ea1900_fra_1", "nat_fra", "prv_fra_indochina", 15_000),
  unit("unt_ea1900_deu_1", "nat_deu", "prv_deu_qingdao", 8_000),
  unit("unt_ea1900_usa_1", "nat_usa", "prv_usa_philippines", 18_000),
]);
