import { z } from "zod";

export const NationIdSchema = z.string().regex(/^nat_[a-z0-9_]+$/);
export const ProvinceIdSchema = z.string().regex(/^prv_[a-z0-9_]+$/);
export const TreatyIdSchema = z.string().regex(/^try_[a-z0-9_]+$/);
export const UnitIdSchema = z.string().regex(/^unt_[a-z0-9_]+$/);
export const WarIdSchema = z.string().regex(/^war_[a-z0-9_]+$/);
export const EventIdSchema = z.string().regex(/^evt_[a-z0-9_]+$/);
export const RequestIdSchema = z.string().regex(/^req_[a-z0-9_]+$/);
