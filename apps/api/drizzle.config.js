// drizzle-kit config. Generate only: never `push` against anything but a local
// scratch DB, and never hand-edit a migration after it has been applied.
//
// TODO: defineConfig({
//   schema: './src/db/schema/index.js',
//   out: './src/db/migrations',
//   dialect: 'postgresql',
//   dbCredentials: { url: process.env.DATABASE_URL },
// })
