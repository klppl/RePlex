# RePlex

> [!CAUTION]
> **VIBE CODED PROJECT — HOST AT YOUR OWN RISK**  
> This project is 100% "vibe coded" (rapidly experimented/generated). It has **NOT** been audited for security.  
> **DO NOT HOST THIS ON THE PUBLIC INTERNET.**  
> It is intended strictly for internal/private network use. If you expose this to the web, you are effectively letting strangers into your house. You have been warned.

## Broken? Fix it.
If something is broken, **fix it and create a Pull Request.**  
If you can't fix it, at least post an Issue with details. We appreciate contributions that keep the vibes going.

---

## Technical Overview
RePlex generates a "Spotify Wrapped" style year-in-review for Plex users by aggregating playback data from Tautulli.

### Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions)
- **Database**: SQLite (managed via [Prisma](https://www.prisma.io/))
- **Integration**: Tautulli API (User playback history)
- **AI**: OpenAI API (GPT-4o) for generating "roast" personality summaries.
- **Styling**: Tailwind CSS & Framer Motion.

### Core Features
- **Admin Dashboard**: (`/admin`) manage users, sync Tautulli history, and trigger report generation.
- **User Dashboard**: (`/dashboard?userId=X`) public-facing (internal) view for users to explore their stats.
- **AI Summaries**:  Generates a "brutally honest" personality roast based on watch history.
- **Caching**: Heavy Tautulli queries are cached in SQLite for instant dashboard loading.

### Setup
1. Clone repo & `npm install`
2. `npx prisma db push`
3. `npm run dev`
4. Visit `/admin` to configure your Tautulli connection and generate admin credentials.
