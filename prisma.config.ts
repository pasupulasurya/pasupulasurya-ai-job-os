import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    adapter: {
      url: process.env.DIRECT_URL!,
    },
  },
  datasource: {
    url: process.env.DIRECT_URL!,
  },
})
