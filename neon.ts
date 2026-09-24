import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      waterbill: { access: "private" },
      electricbill: { access: "private" },
      phonebill: { access: "private" },
    },
    functions: {
      api: { name: "api", source: "./hello.ts" },
    },
  },
});
