# RePlex

> [!WARNING]
> **Experimental Project (AI-Assisted/Vibe Coded)**
> This is a hobby project developed with heavy AI assistance. It has not undergone security auditing.
>
> **Deployment**: Recommended for local/home networks only.
>
> **Risk**: Avoid exposing the dashboard directly to the public internet without a reverse proxy or VPN.
>
> **Disclaimer**: Use at your own risk. I am not responsible for any data loss or unauthorized access.

## Technical Overview
RePlex generates a "Spotify Wrapped" style year-in-review for Plex users by aggregating playback data from Tautulli.

### Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions)
- **Database**: SQLite (managed via [Prisma](https://www.prisma.io/))
- **Integration**: Tautulli API (User playback history)
- **AI**: OpenAI API (GPT-4o) for generating "roast" personality summaries.
- **Styling**: Tailwind CSS & Framer Motion.

### Core Features
- **Sign in with Plex**: Secure OAuth flow. Users log in with their Plex credentials.
- **Admin Dashboard**: (`/admin`) Manage users, sync Tautulli history, and trigger report generation.
- **User Dashboard**: (`/dashboard`) Interactive "Year in Review" stats.
- **AI Summaries**:  Generates a "brutally honest" personality roast based on watch history.
- **Caching**: Heavy Tautulli queries are cached in SQLite for instant dashboard loading.

## Broken? Fix it.
If something is broken, **fix it and create a Pull Request.**  
If you can't fix it, at least post an Issue with details. We appreciate contributions that keep the vibes going.

## Running with Docker

1. Ensure you have Docker and Docker Compose installed.
2. Run `docker compose up --build`.
3. The application will be available at `http://localhost:3000`.
4. The database is persisted in the `./prisma` directory.

### Setup (Local Dev)
1. Clone repo & `npm install`
2. Copy `.env.example` to `.env`: `cp .env.example .env`
3. `npx prisma db push`
4. `npm run dev`
5. Visit `/admin` to configure your Tautulli connection and generate admin credentials.

## Preview
<a href="screenshot.png">
  <img src="screenshot.png" style="width: 100%; max-width: 800px; border-radius: 10px; border: 1px solid #333;" alt="RePlex Dashboard Preview">
</a>