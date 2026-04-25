import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { sql } from '../db.js';

export async function handleRecipes(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, description,
          ingredients, instructions,
          prep_time as "prepTime", cook_time as "cookTime", servings, tags,
          source_url as "sourceUrl", source_platform as "sourcePlatform",
          thumbnail, channel_name as "channelName",
          is_favorite as "isFavorite", sort_order as "sortOrder",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM recipes WHERE user_id = ${userId} AND shared_with_id IS NULL ORDER BY updated_at DESC
      `;
      return res.status(200).json(rows.map((r: Record<string, unknown>) => ({
        ...r,
        ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients as string) : (r.ingredients || []),
        instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions as string) : (r.instructions || []),
      })));
    }
    case 'POST': {
      const { id, title, description, ingredients, instructions, prepTime, cookTime, servings, tags, sourceUrl, sourcePlatform, thumbnail, channelName, isFavorite, sortOrder, createdAt, updatedAt } = req.body;
      if (sourceUrl) {
        const existing = await sql`SELECT id FROM recipes WHERE user_id = ${userId} AND source_url = ${sourceUrl}`;
        if (existing.length > 0) {
          return res.status(409).json({ error: 'A recipe with this URL already exists.' });
        }
      }
      await sql`
        INSERT INTO recipes (id, user_id, title, description, ingredients, instructions, prep_time, cook_time, servings, tags, source_url, source_platform, thumbnail, channel_name, is_favorite, sort_order, created_at, updated_at)
        VALUES (${id}, ${userId}, ${title}, ${description || null}, ${JSON.stringify(ingredients || [])}, ${JSON.stringify(instructions || [])}, ${prepTime || null}, ${cookTime || null}, ${servings || null}, ${tags || []}, ${sourceUrl || null}, ${sourcePlatform || 'manual'}, ${thumbnail || null}, ${channelName || null}, ${isFavorite || false}, ${sortOrder !== undefined ? sortOrder : null}, ${createdAt || new Date().toISOString()}, ${updatedAt || new Date().toISOString()})
      `;
      return res.status(201).json({ success: true });
    }
    case 'PUT': {
      const { id, title, description, ingredients, instructions, prepTime, cookTime, servings, tags, sourceUrl, sourcePlatform, thumbnail, channelName, isFavorite, sortOrder, updatedAt } = req.body;
      if (sourceUrl) {
        const existing = await sql`SELECT id FROM recipes WHERE user_id = ${userId} AND source_url = ${sourceUrl} AND id != ${id}`;
        if (existing.length > 0) {
          return res.status(409).json({ error: 'A recipe with this URL already exists.' });
        }
      }
      await sql`
        UPDATE recipes SET
          title = ${title},
          description = ${description || null},
          ingredients = ${JSON.stringify(ingredients || [])},
          instructions = ${JSON.stringify(instructions || [])},
          prep_time = ${prepTime || null},
          cook_time = ${cookTime || null},
          servings = ${servings || null},
          tags = ${tags || []},
          source_url = ${sourceUrl || null},
          source_platform = ${sourcePlatform || 'manual'},
          thumbnail = ${thumbnail || null},
          channel_name = ${channelName || null},
          is_favorite = ${isFavorite || false},
          sort_order = ${sortOrder !== undefined ? sortOrder : null},
          updated_at = ${updatedAt || new Date().toISOString()}
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return res.status(200).json({ success: true });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM recipes WHERE id = ${id as string} AND user_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function handleRecipeShare(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipeId, email } = req.body;
  if (!recipeId || !email) {
    return res.status(400).json({ error: 'Recipe ID and email are required' });
  }

  // Find the target user
  const users = await sql`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`;
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const targetUser = users[0];
  if (targetUser.id === userId) {
    return res.status(400).json({ error: 'Cannot share with yourself' });
  }

  // Fetch the recipe
  const recipes = await sql`
    SELECT id, title, description, ingredients, instructions,
      prep_time, cook_time, servings, tags, source_url, source_platform,
      thumbnail, channel_name
    FROM recipes WHERE id = ${recipeId} AND user_id = ${userId}
  `;
  if (recipes.length === 0) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  const recipe = recipes[0];
  const newId = `shared_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Get sender name
  const senderRows = await sql`SELECT name FROM users WHERE id = ${userId}`;
  const senderName = senderRows.length > 0 ? senderRows[0].name as string : 'Someone';

  // Check if already shared with this user
  const existing = await sql`
    SELECT id FROM recipes
    WHERE shared_by_id = ${userId} AND shared_with_id = ${targetUser.id as string}
      AND title = ${recipe.title as string}
  `;
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Recipe already shared with this user' });
  }

  // Insert shared copy into recipes table
  await sql`
    INSERT INTO recipes (id, user_id, title, description, ingredients, instructions,
      prep_time, cook_time, servings, tags, source_url, source_platform,
      thumbnail, channel_name, is_favorite, sort_order,
      shared_by_id, shared_by_name, shared_with_id,
      created_at, updated_at)
    VALUES (
      ${newId}, ${userId}, ${recipe.title as string},
      ${recipe.description as string || null},
      ${typeof recipe.ingredients === 'string' ? recipe.ingredients as string : JSON.stringify(recipe.ingredients || [])},
      ${typeof recipe.instructions === 'string' ? recipe.instructions as string : JSON.stringify(recipe.instructions || [])},
      ${recipe.prep_time as number || null}, ${recipe.cook_time as number || null},
      ${recipe.servings as number || null},
      ${recipe.tags as string[] || []},
      ${recipe.source_url as string || null}, ${recipe.source_platform as string || 'manual'},
      ${recipe.thumbnail as string || null}, ${recipe.channel_name as string || null},
      false, null,
      ${userId}, ${senderName}, ${targetUser.id as string},
      ${now}, ${now}
    )
  `;

  return res.status(201).json({
    success: true,
    sharedWith: { name: targetUser.name, email: targetUser.email },
    message: `Recipe shared with ${targetUser.name}`,
  });
}

export async function handleSharedRecipes(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const rows = await sql`
        SELECT id, title, description,
          ingredients, instructions,
          prep_time as "prepTime", cook_time as "cookTime", servings, tags,
          source_url as "sourceUrl", source_platform as "sourcePlatform",
          thumbnail, channel_name as "channelName",
          is_favorite as "isFavorite", sort_order as "sortOrder",
          created_at as "createdAt", updated_at as "updatedAt",
          shared_by_name as "sharedByName",
          created_at as "sharedAt"
        FROM recipes WHERE shared_with_id = ${userId}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(rows.map((r: Record<string, unknown>) => ({
        ...r,
        ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients as string) : (r.ingredients || []),
        instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions as string) : (r.instructions || []),
      })));
    }
    case 'DELETE': {
      const { id } = req.query;
      if (id) await sql`DELETE FROM recipes WHERE id = ${id as string} AND shared_with_id = ${userId}`;
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// YouTube video ID extractor
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function handleRecipeExtract(req: VercelRequest, res: VercelResponse, _userId: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, text } = req.body;

  // ── Text paste path ──────────────────────────────────────────────────────────
  if (text) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'AI parsing not configured on server.' });
    }
    let extracted: Record<string, unknown>;
    try {
      const client = new OpenAI({
        baseURL: 'https://models.github.ai/inference',
        apiKey: GITHUB_TOKEN,
      });
      const aiResponse = await client.chat.completions.create({
        model: 'openai/gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a recipe extraction assistant. Parse raw recipe text into structured data. Always respond with valid JSON only, no markdown.',
          },
          {
            role: 'user',
            content: `Parse the following text into a structured recipe. Return ONLY a valid JSON object with these exact fields:
- "title": string (recipe name)
- "description": string (1-2 sentence dish description)
- "ingredients": array of objects { "amount": string, "unit": string, "name": string }
- "instructions": array of strings (numbered steps as plain text)
- "prepTime": number (minutes, null if unknown)
- "cookTime": number (minutes, null if unknown)
- "servings": number (null if unknown)
- "tags": array of strings (e.g. ["Italian","pasta"])

If no recognisable recipe is present, return: {"error": "No recipe found"}

Recipe text:
${(text as string).substring(0, 6000)}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.1,
      });
      extracted = JSON.parse(aiResponse.choices[0].message.content ?? '{}') as Record<string, unknown>;
    } catch (aiError) {
      console.error('GitHub Models AI error:', aiError);
      return res.status(500).json({ error: 'AI parsing failed. Please try again.' });
    }
    if (extracted.error) {
      return res.status(422).json({ error: extracted.error as string });
    }
    return res.status(200).json({ ...extracted, sourcePlatform: 'manual' });
  }

  // ── URL path (YouTube) ───────────────────────────────────────────────────────
  if (!url) {
    return res.status(400).json({ error: 'Either url or text is required' });
  }

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  // Only YouTube supported for now
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Only YouTube URLs are supported. Paste a youtube.com or youtu.be link.' });
  }

  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YouTube API key not configured on server.' });
  }

  // Fetch video details from YouTube Data API v3
  const ytResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`
  );
  if (!ytResponse.ok) {
    return res.status(502).json({ error: 'Failed to fetch YouTube video data. Check your API key.' });
  }
  const ytData = await ytResponse.json() as { items?: Array<{ snippet: { title: string; description: string; channelTitle: string; thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } } }> };
  if (!ytData.items || ytData.items.length === 0) {
    return res.status(404).json({ error: 'YouTube video not found or is private.' });
  }

  const snippet = ytData.items[0].snippet;
  const videoTitle = snippet.title;
  const description = snippet.description || '';
  const channelName = snippet.channelTitle;
  const thumbnail =
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url || '';

  const baseResult = {
    title: videoTitle,
    channelName,
    thumbnail,
    sourceUrl: url,
    sourcePlatform: 'youtube' as const,
    description: description.substring(0, 400),
    ingredients: [] as unknown[],
    instructions: [] as string[],
    tags: [] as string[],
  };

  // If no GitHub token, return raw YouTube metadata only
  if (!GITHUB_TOKEN) {
    return res.status(200).json(baseResult);
  }

  // Use GitHub Models (gpt-4.1-mini) to extract recipe from description
  let extracted: Record<string, unknown>;
  try {
    const client = new OpenAI({
      baseURL: 'https://models.github.ai/inference',
      apiKey: GITHUB_TOKEN,
    });

    const aiResponse = await client.chat.completions.create({
      model: 'openai/gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a recipe extraction assistant. Extract structured recipe data from YouTube video info. Always respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Extract the recipe from this YouTube video. Return ONLY a valid JSON object with these exact fields:
- "title": string (clean recipe name; simplify if needed)
- "description": string (1-2 sentence dish description)
- "ingredients": array of objects { "amount": string, "unit": string, "name": string }
- "instructions": array of strings (numbered steps as plain text)
- "prepTime": number (minutes, estimate if not stated, null if unknown)
- "cookTime": number (minutes, estimate if not stated, null if unknown)
- "servings": number (estimate if not stated, null if unknown)
- "tags": array of strings (cuisine type, dietary info, e.g. ["Italian","pasta","vegetarian"])

If no recipe is found in the description, return: {"error": "No recipe found in description"}

Video Title: ${videoTitle}
Video Description (first 3000 chars):
${description.substring(0, 3000)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.1,
    });

    extracted = JSON.parse(aiResponse.choices[0].message.content ?? '{}') as Record<string, unknown>;
  } catch (aiError) {
    console.error('GitHub Models AI error:', aiError);
    return res.status(200).json(baseResult);
  }

  if (extracted.error) {
    return res.status(422).json({
      error: extracted.error as string,
      title: videoTitle,
      channelName,
      thumbnail,
      sourceUrl: url,
      sourcePlatform: 'youtube',
    });
  }

  return res.status(200).json({
    ...extracted,
    title: (extracted.title as string) || videoTitle,
    channelName,
    thumbnail,
    sourceUrl: url,
    sourcePlatform: 'youtube',
  });
}
