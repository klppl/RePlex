export async function generateAiSummary(
    aiConfig: { enabled: boolean; apiKey: string | null; instructions?: string | null; model?: string | null } | null,
    statsContext: Record<string, any>,
    options: { forceRefresh?: boolean; onProgress?: (msg: string) => void }
): Promise<string | undefined> {
    if (!aiConfig?.enabled || !aiConfig.apiKey) return undefined;

    console.log("Generating AI Summary...");
    if (options.onProgress) options.onProgress("Generating AI Summary (this may take 10-20 seconds)...");
    try {
        const OpenAI = require("openai");
        const openai = new OpenAI({ apiKey: aiConfig.apiKey });

        const systemPrompt = aiConfig.instructions || "Analyze the user's Plex statistics and produce a brutally honest /r/roastme-style roast. Be mean, dry, and sarcastic. No empathy, no disclaimers, no praise unless it is immediately undercut. Treat the stats as evidence of bad habits, questionable taste, avoidance of sleep, commitment issues, nostalgia addiction, or fake \"good taste.\" If data is missing, infer something unflattering. Write one or two short paragraphs that summarize the user as a person based solely on their viewing behavior. No emojis, no self-reference, no moral lessons. Roast choices and habits only, not protected traits. The result should be funny, uncomfortable, and very shareable.";

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Here are the user's stats for the year: ${JSON.stringify(statsContext)}. Write a short summary paragraph.` }
            ],
            model: aiConfig.model || "gpt-4o",
        });

        return completion.choices[0].message.content;
    } catch (e: any) {
        console.error("AI Generation Failed", e.message);
        return "AI Summary unavailable (Error generated).";
    }
}
