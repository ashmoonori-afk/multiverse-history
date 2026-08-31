import { z } from "zod";

const NewsQuoteSchema = z
  .object({
    textKo: z.string().trim().min(1).max(500),
    attributionKo: z.string().trim().min(1).max(120),
  })
  .strict()
  .readonly();

const NewsFields = {
  headlineKo: z.string().trim().min(1).max(160),
  ledeKo: z.string().trim().min(1).max(600),
  paragraphsKo: z.array(z.string().trim().min(1).max(1_200)).min(2).max(6).readonly(),
} as const;

const NewsOutputSchema = z
  .object({ ...NewsFields, quote: NewsQuoteSchema.optional() })
  .strict()
  .readonly();

const ProviderNewsOutputSchema = z
  .object({ ...NewsFields, quote: NewsQuoteSchema.nullish() })
  .strict()
  .readonly();

export type NewsOutput = z.infer<typeof NewsOutputSchema>;

const normalizeProse = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replaceAll(/[^\p{L}\p{N}]/gu, "");

export const parseNewsOutput = (value: unknown, rawOrder: string): NewsOutput => {
  const providerArticle = ProviderNewsOutputSchema.parse(value);
  const article = NewsOutputSchema.parse({
    headlineKo: providerArticle.headlineKo,
    ledeKo: providerArticle.ledeKo,
    paragraphsKo: providerArticle.paragraphsKo,
    ...(providerArticle.quote === null || providerArticle.quote === undefined
      ? {}
      : { quote: providerArticle.quote }),
  });
  const normalizedOrder = normalizeProse(rawOrder);
  const prose = [
    article.headlineKo,
    article.ledeKo,
    ...article.paragraphsKo,
    ...(article.quote === undefined ? [] : [article.quote.textKo]),
  ];
  if (
    normalizedOrder.length > 0 &&
    prose.some((entry) => normalizeProse(entry).includes(normalizedOrder))
  ) {
    throw new TypeError("PROVIDER_NEWS_PARROTS_ORDER");
  }
  return article;
};

export const newsJsonSchema = (): object => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    headlineKo: { type: "string", minLength: 1, maxLength: 160 },
    ledeKo: { type: "string", minLength: 1, maxLength: 600 },
    paragraphsKo: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 1_200 },
    },
    quote: {
      type: ["object", "null"],
      properties: {
        textKo: { type: "string", minLength: 1, maxLength: 500 },
        attributionKo: { type: "string", minLength: 1, maxLength: 120 },
      },
      required: ["textKo", "attributionKo"],
      additionalProperties: false,
    },
  },
  required: ["headlineKo", "ledeKo", "paragraphsKo", "quote"],
  additionalProperties: false,
});
