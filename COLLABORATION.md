

## 4. Verification commands

After every change, run as needed:

- npx tsc --noEmit : TypeScript check
- npm run db:generate : after schema.prisma changes
- npm run lint : style and format
- npm run scrape:gh -- --slug=anthropic : test one scraper
- npm run cleanup -- --dry-run : safe cleanup test
- git status : see what is about to commit
- wc -l filepath : sanity-check file size
- head -10 filepath : sanity-check top of file

working rhythm. Read once, refer back when something feels off.
