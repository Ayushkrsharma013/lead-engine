// lib/blog/voice-extractor.ts
// Gemini-powered voice profile extraction from writing samples

export async function extractVoiceProfile(
  samples: string[],
  profileName: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const prompt = `You are a writing style analyst. Analyze these ${samples.length} writing samples and extract a structured voice profile.

## Writing Samples
${samples.map((s, i) => `### Sample ${i + 1}\n${s}`).join('\n\n')}

## Instructions
Return ONLY valid JSON (no markdown, no backticks). Identify:

1. **sentence_profile**: avg word count range, rhythm style, a concrete rule for the writer to follow
2. **hooks**: primary hook pattern, what to avoid, an example hook in the writer's style
3. **tone**: baseline tone (confident/direct/warm/etc), humor style and frequency, persona description
4. **formatting**: paragraph density, bullet usage rules, bold/emphasis rules
5. **transitions**: 5-8 words or phrases this writer uses to connect ideas
6. **cta_style**: how the writer frames calls-to-action
7. **anti_patterns**: 3-5 things this writer should never do (clichés, specific phrases, emoji rules)

JSON shape:
{
  "voice_name": "${profileName}",
  "sentence_profile": { "avg_length": "...", "style": "...", "rule": "..." },
  "hooks": { "primary": "...", "avoid": "...", "example": "..." },
  "tone": { "baseline": "...", "humor": "...", "persona": "..." },
  "formatting": { "paragraph_density": "...", "bullets": "...", "bold_usage": "..." },
  "transitions": ["...", "..."],
  "cta_style": "...",
  "anti_patterns": ["...", "..."]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  const rawText = (parts?.find((p: any) => !p.thought) ?? parts?.[0])?.text ?? '';

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse voice profile JSON from Gemini response');
  return JSON.parse(jsonMatch[0]);
}
