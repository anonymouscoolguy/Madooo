import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only the pure mapper is tested. Prisma, Next's rendering and the network
    // client are third-party or side-effectful and are not this suite's job.
    include: ['src/**/*.test.ts'],
  },
})
