const provinceLabelsKo: Readonly<Record<string, string>> = Object.freeze({
  prv_kor_hanseong: "한성",
  prv_kor_gyeonggi: "경기",
  prv_kor_pyeongan: "평안",
  prv_jpn_kanto: "간토",
  prv_qing_zhili: "직례",
  prv_rus_primorye: "연해주",
});

export const provinceNameKo = (provinceId: string): string =>
  provinceLabelsKo[provinceId] ?? provinceId;
