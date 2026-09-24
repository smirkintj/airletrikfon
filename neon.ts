import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Managed Better Auth: email + password login (see src/lib/auth.ts).
  auth: true,
  // Original bill PDFs, one private bucket per category (see src/lib/store.ts).
  buckets: {
    waterbill: { access: "private" },
    electricbill: { access: "private" },
    phonebill: { access: "private" },
  },
  functions: {
    api: { name: "api", source: "./hello.ts" },
  },
});
