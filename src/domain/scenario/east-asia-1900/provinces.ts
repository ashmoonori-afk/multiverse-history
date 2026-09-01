import { parseNationId } from "../../../shared/ids";
import type { ProvinceDefinition } from "../registry";

const province = (id: string, nationId: string, population: number): ProvinceDefinition =>
  Object.freeze({
    id,
    ownerNationId: parseNationId(nationId),
    population,
  });

export const eastAsiaProvinces: readonly ProvinceDefinition[] = Object.freeze([
  province("prv_kor_hanseong", "nat_kor", 1_200_000),
  province("prv_kor_gyeonggi", "nat_kor", 2_200_000),
  province("prv_kor_pyeongan", "nat_kor", 2_300_000),
  province("prv_kor_hamgyeong", "nat_kor", 1_500_000),
  province("prv_kor_chungcheong", "nat_kor", 2_700_000),
  province("prv_kor_jeolla", "nat_kor", 3_500_000),
  province("prv_kor_gyeongsang", "nat_kor", 3_682_000),
  province("prv_jpn_hokkaido", "nat_jpn", 3_000_000),
  province("prv_jpn_tohoku", "nat_jpn", 5_000_000),
  province("prv_jpn_kanto", "nat_jpn", 10_000_000),
  province("prv_jpn_chubu", "nat_jpn", 6_000_000),
  province("prv_jpn_kansai", "nat_jpn", 8_000_000),
  province("prv_jpn_chugoku_shikoku", "nat_jpn", 5_000_000),
  province("prv_jpn_kyushu", "nat_jpn", 6_850_000),
  province("prv_qing_manchuria", "nat_qing", 45_000_000),
  province("prv_qing_zhili", "nat_qing", 60_000_000),
  province("prv_qing_shandong", "nat_qing", 35_000_000),
  province("prv_qing_jiangnan", "nat_qing", 85_000_000),
  province("prv_qing_central", "nat_qing", 70_000_000),
  province("prv_qing_south", "nat_qing", 55_000_000),
  province("prv_qing_west", "nat_qing", 50_000_000),
  province("prv_rus_primorye", "nat_rus", 2_000_000),
  province("prv_rus_amur", "nat_rus", 1_500_000),
  province("prv_rus_transbaikal", "nat_rus", 3_000_000),
  province("prv_rus_core", "nat_rus", 129_500_000),
  province("prv_gbr_hongkong", "nat_gbr", 300_000),
  province("prv_gbr_burma", "nat_gbr", 10_000_000),
  province("prv_gbr_malaya", "nat_gbr", 2_000_000),
  province("prv_fra_indochina", "nat_fra", 15_000_000),
  province("prv_deu_qingdao", "nat_deu", 200_000),
  province("prv_deu_pacific", "nat_deu", 500_000),
  province("prv_usa_philippines", "nat_usa", 7_000_000),
  province("prv_nld_east_indies", "nat_nld", 38_000_000),
  province("prv_tha_siam", "nat_tha", 8_000_000),
]);
