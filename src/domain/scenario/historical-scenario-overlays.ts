interface MajorPolity {
  readonly sourceName: string;
  readonly nameKo: string;
  readonly capitalLabelKo: string;
  readonly bloc: string;
  readonly population?: number;
}

const polity = (
  sourceName: string,
  nameKo: string,
  capitalLabelKo: string,
  bloc: string,
  population?: number,
): MajorPolity =>
  Object.freeze({
    sourceName,
    nameKo,
    capitalLabelKo,
    bloc,
    ...(population === undefined ? {} : { population }),
  });

const overlays = Object.freeze({
  scn_bronze_1200bc: [
    polity("Assyria", "앗시리아", "아슈르", "mesopotamia", 800_000),
    polity("Babylonia", "바빌로니아", "바빌론", "mesopotamia", 1_000_000),
    polity("Egypt", "이집트 신왕국", "테베", "nile", 3_000_000),
    polity("Greek city-states", "에게 도시국가", "미케네", "aegean", 750_000),
    polity("Phrygians", "프리기아 왕국", "고르디온", "anatolia", 400_000),
    polity("Kingdom of David and Solomon", "이스라엘 왕국", "예루살렘", "levant", 350_000),
    polity("Elam", "엘람", "수사", "iran", 400_000),
    polity("Kush", "쿠시 왕국", "나파타", "nile", 200_000),
    polity("Arameans", "아람 왕국군", "다마스쿠스", "levant", 300_000),
    polity("Urartu", "우라르투 왕국", "투시파", "anatolia", 400_000),
  ],
  scn_classical_117: [
    polity("Roman Empire", "로마 제국", "로마", "rome", 65_000_000),
    polity("Han", "한 제국", "낙양", "han", 55_000_000),
    polity("Parthian Empire", "파르티아 제국", "크테시폰", "iran", 10_000_000),
    polity("Kushan Empire", "쿠샨 제국", "푸루샤푸라", "silkroad", 15_000_000),
    polity("Axum", "악숨 왕국", "악숨", "redsea", 500_000),
    polity("Armenia", "아르메니아 왕국", "아르타샤트", "caucasus", 2_000_000),
    polity("Koguryo", "고구려", "국내성", "han", 400_000),
    polity("Maya chiefdoms and states", "마야 도시국가", "티칼", "mesoamerica", 2_000_000),
    polity("Meroe", "메로에 왕국", "메로에", "nile", 500_000),
  ],
  scn_medieval_1200: [
    polity("Song Empire", "남송", "임안", "eastasia", 60_000_000),
    polity("Mongol Empire", "몽골 제국", "카라코룸", "steppe", 1_000_000),
    polity("Goryeo", "고려", "개경", "eastasia", 3_000_000),
    polity("Imperial Japan (Fujiwara)", "일본 조정", "헤이안쿄", "eastasia", 7_000_000),
    polity("Sultanate of Delhi", "델리 술탄국", "델리", "india", 25_000_000),
    polity("Byzantine Empire", "비잔티움 제국", "콘스탄티노폴리스", "europe", 6_000_000),
    polity("Holy Roman Empire", "신성 로마 제국", "아헨", "europe", 12_000_000),
    polity("Kingdom of France", "프랑스 왕국", "파리", "europe", 12_000_000),
    polity("Chola state", "촐라 왕국", "강가이콘다촐라푸람", "india", 5_000_000),
    polity("Almohad Caliphate", "무와히드 칼리파국", "마라케시", "maghreb", 8_000_000),
  ],
  scn_steppe_1300: [
    polity("Great Khanate", "대칸국", "대도", "mongol", 80_000_000),
    polity("Khanate of the Golden Horde", "킵차크 칸국", "사라이", "mongol", 6_000_000),
    polity("Ilkhanate", "일 칸국", "타브리즈", "mongol", 8_000_000),
    polity("Chagatai Khanate", "차가타이 칸국", "알말리크", "mongol", 4_000_000),
    polity("Mamluke Sultanate", "맘루크 술탄국", "카이로", "islam", 6_000_000),
    polity("Sultanate of Delhi", "델리 술탄국", "델리", "india", 40_000_000),
    polity("Byzantine Empire", "비잔티움 제국", "콘스탄티노폴리스", "europe", 2_500_000),
    polity("France", "프랑스 왕국", "파리", "europe", 16_000_000),
    polity("Grand Duchy of Moscow", "모스크바 대공국", "모스크바", "rus", 400_000),
    polity("Shogun Japan (Kamakura)", "가마쿠라 막부", "가마쿠라", "eastasia", 7_000_000),
  ],
  scn_trade_1650: [
    polity("Mughal Empire", "무굴 제국", "아그라", "asian", 130_000_000),
    polity("Ottoman Empire", "오스만 제국", "콘스탄티니예", "continental", 25_000_000),
    polity("Safavid Empire", "사파비 제국", "이스파한", "continental", 9_000_000),
    polity("Dutch Republic", "네덜란드 공화국", "암스테르담", "maritime", 1_900_000),
    polity("England and Ireland", "잉글랜드 연방", "런던", "maritime", 7_000_000),
    polity("France", "프랑스 왕국", "파리", "continental", 20_000_000),
    polity("Spain", "스페인 왕국", "마드리드", "maritime", 7_000_000),
    polity("Portugal", "포르투갈 왕국", "리스본", "maritime", 2_000_000),
    polity("Manchu Empire", "청 제국", "베이징", "asian", 120_000_000),
    polity("Tokugawa Shogunate", "에도 막부", "에도", "asian", 18_000_000),
    polity("Korea", "조선", "한성", "asian", 10_000_000),
    polity("Ayutthaya", "아유타야 왕국", "아유타야", "asian", 2_000_000),
  ],
  scn_world_1939: [
    polity("Germany", "독일국", "베를린", "axis", 79_000_000),
    polity("USSR", "소비에트 연방", "모스크바", "comintern", 170_500_000),
    polity("United States", "미합중국", "워싱턴", "allies", 131_000_000),
    polity("United Kingdom", "대영제국", "런던", "allies", 48_000_000),
    polity("France", "프랑스 공화국", "파리", "allies", 42_000_000),
    polity("Empire of Japan", "일본제국", "도쿄", "axis", 71_000_000),
    polity("Italy", "이탈리아 왕국", "로마", "axis", 44_000_000),
    polity("Poland", "폴란드 공화국", "바르샤바", "allies", 35_000_000),
    polity("British Raj", "영국령 인도", "뉴델리", "allies", 380_000_000),
    polity("Chinese warlords", "중화민국 군벌 연합", "충칭", "allies", 510_000_000),
  ],
  scn_coldwar_1962: [
    polity("United States", "미합중국", "워싱턴", "west", 186_000_000),
    polity("USSR", "소비에트 연방", "모스크바", "east", 218_000_000),
    polity("China", "중화인민공화국", "베이징", "east", 670_000_000),
    polity("United Kingdom", "영국", "런던", "west", 53_000_000),
    polity("France", "프랑스", "파리", "west", 47_000_000),
    polity("West Germany", "서독", "본", "west", 57_000_000),
    polity("East Germany", "동독", "동베를린", "east", 17_000_000),
    polity("India", "인도 공화국", "뉴델리", "nonaligned", 450_000_000),
    polity("Japan", "일본국", "도쿄", "west", 95_000_000),
    polity("Cuba", "쿠바 공화국", "아바나", "east", 7_000_000),
  ],
  scn_modern: [
    polity("Korea, Republic of", "대한민국", "서울", "atlantic", 52_000_000),
    polity("United States", "미합중국", "워싱턴", "atlantic", 340_000_000),
    polity("China", "중화인민공화국", "베이징", "eurasian", 1_410_000_000),
    polity("Russia", "러시아 연방", "모스크바", "eurasian", 146_000_000),
    polity("Germany", "독일 연방공화국", "베를린", "atlantic", 84_000_000),
    polity("United Kingdom", "영국", "런던", "atlantic", 69_000_000),
    polity("France", "프랑스 공화국", "파리", "atlantic", 68_000_000),
    polity("India", "인도 공화국", "뉴델리", "nonaligned", 1_460_000_000),
    polity("Japan", "일본국", "도쿄", "atlantic", 123_000_000),
    polity("Brazil", "브라질 연방공화국", "브라질리아", "nonaligned", 213_000_000),
  ],
  // 2281 assumes a 2090 demographic peak, regionally uneven collapse, and
  // roughly 0.5% annual recovery through 2281; the ten factions total ~1.47B.
  scn_reconstruction_2281: [
    polity("China", "중화 재건국", "신베이징", "eurasian", 310_000_000),
    polity("Korea, Republic of", "한강 도시연합", "서울 메가폴리스", "pacific", 88_000_000),
    polity("United States", "대서양 연방", "뉴 컬럼비아", "atlantic", 280_000_000),
    polity("Russia", "북방 연방", "노바 모스크바", "eurasian", 120_000_000),
    polity("Germany", "라인 공동체", "베를린 돔", "continental", 72_000_000),
    polity("United Kingdom", "브리튼 해양령", "런던 방벽", "atlantic", 54_000_000),
    polity("France", "갈리아 코뮌", "파리 아르콜로지", "continental", 61_000_000),
    polity("India", "인더스 연합", "나바 델리", "nonaligned", 260_000_000),
    polity("Japan", "열도 기술막부", "네오에도", "pacific", 83_000_000),
    polity("Brazil", "아마존 생태연맹", "브라질리아 코어", "nonaligned", 145_000_000),
  ],
} satisfies Readonly<Record<string, readonly MajorPolity[]>>);

export const historicalMajorPolities = (scenarioId: string): readonly MajorPolity[] =>
  overlays[scenarioId as keyof typeof overlays] ?? Object.freeze([]);

const sovereignAliases: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  scn_medieval_1200: Object.freeze({ "Kingdom of France": "France" }),
  scn_steppe_1300: Object.freeze({
    "Great Khanate": "Mongol Empire",
    "Chagatai Khanate": "Mongol Empire",
  }),
  scn_trade_1650: Object.freeze({ Spain: "Spanish Habsburg" }),
  scn_world_1939: Object.freeze({ "British Raj": "United Kingdom" }),
});

export const historicalSovereignName = (scenarioId: string, sourceName: string): string =>
  sovereignAliases[scenarioId]?.[sourceName] ?? sourceName;
