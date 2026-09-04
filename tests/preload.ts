import { afterAll } from "bun:test";

import { cleanupTestSlotRoot } from "../src/api/app";

afterAll(cleanupTestSlotRoot);
