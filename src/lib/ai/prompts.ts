// ============================================================
// Prompt Builder
//
// All prompt construction lives here — keeping prompts
// centralised makes them easy to iterate without touching
// the service layer.
//
// Design philosophy:
//   - System prompts establish persona, rules, and constraints
//   - User prompts provide the specific task + all context
//   - Few-shot examples are embedded to anchor the output style
//   - JSON output is requested where structured data is needed
//   - Every prompt ends with explicit output format instructions
// ============================================================

import type {
  LeadContext,
  SenderContext,
  GenerationConfig,
  ToneProfile,
  CommentSummary,
} from '../../types/ai'

// ── Tone descriptors ───────────────────────────────────────
// Used in system prompt to shape writing style.

const TONE_DESCRIPTORS: Record<ToneProfile, string> = {
  professional: `
    - Write with confidence and authority
    - Use precise industry language appropriate for senior professionals
    - Maintain a respectful, formal-adjacent tone — not stiff, but polished
    - Avoid slang or overly casual phrasing
    - Sentences are complete and well-structured`.trim(),

  conversational: `
    - Write as a smart, personable industry peer, not a salesperson
    - Use natural contractions (I'm, you've, that's)
    - Short sentences mix with medium ones — varies the rhythm
    - Sounds like something you'd actually say out loud
    - Warm but not sycophantic — no "I love your work!" energy`.trim(),

  direct: `
    - Get to the point quickly — no preamble
    - Short, clear sentences
    - Every word earns its place
    - Confident without being blunt to the point of rudeness
    - Zero filler phrases ("I hope this finds you well", "As per my last message")`.trim(),

  warm: `
    - Genuine, human, and encouraging
    - Lead with empathy and curiosity rather than agenda
    - References specific things about the person
    - Feels like it's from someone who actually read their profile
    - Slightly longer than direct — relationship-building takes a sentence or two more`.trim(),
}

// ── Personalisation depth descriptors ──────────────────────

const DEPTH_INSTRUCTIONS: Record<1 | 2 | 3, string> = {
  1: 'Use only the person\'s name, job title, and company. Keep it brief.',
  2: 'Reference their job title, company, city/region, and one skill or experience detail. Be specific but concise.',
  3: 'Weave in their seniority, specific skills, recent experience roles, and location. Make it feel like you genuinely know their background.',
}

// ── Shared system prompt core ──────────────────────────────

function buildSystemCore(config: GenerationConfig, sender: SenderContext): string {
  const bannedList = config.banned_phrases.length > 0
    ? `\nNEVER use these phrases or topics: ${config.banned_phrases.join(', ')}`
    : ''

  const customInstructions = config.custom_instructions
    ? `\nAdditional instructions from the user:\n${config.custom_instructions}`
    : ''

  return `You are an expert LinkedIn outreach copywriter specialising in the ${config.target_industry} sector in the UK.

You write on behalf of ${sender.name}, ${sender.role} at ${sender.company}.

TONE: ${TONE_DESCRIPTORS[config.tone]}

PERSONALISATION: ${DEPTH_INSTRUCTIONS[config.personalisation_depth]}

ABSOLUTE RULES — violating any of these means the output is rejected:
1. Never write anything spammy, salesy, or that reads like a mass message
2. Never use "I hope this message finds you well" or any variation
3. Never claim guaranteed results, ROI, or outcomes
4. Never pretend to have met or spoken with the person before if you haven't
5. Never use "Dear [Name]" — always "Hi [First name]"
6. Never reference competitors by name
7. Never include URLs, phone numbers, or email addresses
8. Never use ALL CAPS for emphasis
9. Write in British English (honour, colour, recognise, whilst, etc.)
10. Output ONLY the requested content — no preamble, no explanation, no "Here's the message:"${bannedList}${customInstructions}`
}

// ── CONNECTION NOTE PROMPT ─────────────────────────────────

export interface ConnectionNotePromptParams {
  lead:      LeadContext
  sender:    SenderContext
  config:    GenerationConfig
  template?: string   // user's base template (if any)
  hint?:     string   // regeneration instruction
}

export function buildConnectionNotePrompts(params: ConnectionNotePromptParams): {
  system: string
  user:   string
} {
  const { lead, sender, config, template, hint } = params

  const system = `${buildSystemCore(config, sender)}

SPECIFIC RULES FOR CONNECTION NOTES:
- Maximum 300 characters (LinkedIn hard limit) — count carefully
- Include EXACTLY ONE call-to-action or reason to connect
- Must feel personal and specific — not like a template
- Do NOT ask for a call, meeting, or sale in a connection note — it's too early
- End with something that invites a connection, not a transaction
- Output the note text only — nothing else`

  const leadDetails = buildLeadDetails(lead, config.personalisation_depth)

  const templateSection = template
    ? `\nUser's base template (use as inspiration, not verbatim):\n"${template}"\n`
    : ''

  const hintSection = hint
    ? `\nSpecific instruction for this generation: ${hint}\n`
    : ''

  const user = `Write a personalised LinkedIn connection note for the following person:

${leadDetails}${templateSection}${hintSection}
Remember: 300 characters MAXIMUM. Count the characters before responding.

Few-shot examples of the CORRECT style and length:

GOOD (conversational, specific, under 300 chars):
"Hi Sarah, spotted your work on the Hinkley Point civils package — impressive stuff. I work in groundworks supply and would love to connect with senior QSs in the infrastructure space."

GOOD (direct, specific, under 300 chars):
"Hi James, your background across BAM and Balfour Beatty groundworks is exactly the kind of experience I'm looking to connect with. Worth staying in touch?"

BAD (too generic — rejected):
"Hi [Name], I came across your profile and would love to connect with you as I think we could benefit each other professionally."

BAD (too salesy — rejected):
"Hi Michael, I help civil engineering firms increase revenue by 40%. Would love to show you how. Connect?"

Now write the connection note:`

  return { system, user }
}

// ── COMMENT PROMPT ─────────────────────────────────────────

export type CommentTone = 'funny' | 'serious' | 'congratulatory' | 'insightful' | 'questioning'

export interface CommentPromptParams {
  lead:         LeadContext
  sender:       SenderContext
  config:       GenerationConfig
  postContent:  string
  postAuthor:   string
  toneOverride?: CommentTone
}

const COMMENT_TONE_INSTRUCTIONS: Record<CommentTone, string> = {
  funny: `Write a genuinely witty comment. It should be clever, not try-hard. A dry observation, a playful twist on something in the post, or a self-aware industry joke. Never use forced hashtag humour or puns that don't land.`,

  serious: `Write a substantive, thoughtful comment that adds real value. Reference a specific detail from the post. Share a genuine perspective or contrasting view. This should read like something an industry expert would say — not a compliment.`,

  congratulatory: `Write a warm, specific congratulations that feels genuine. Reference what specifically impresses you. Short and sincere is better than long and generic. Don't start with "Congratulations!" — find a more interesting opener.`,

  insightful: `Write a comment that contributes a new angle, data point, or practical observation related to the post's topic. This is the 'adds-to-the-conversation' type. Should make the post author think.`,

  questioning: `Write a curious, engaged question that shows you've read the post carefully. Open-ended, genuinely interested in their perspective. Not a gotcha — a real question that invites them to share more.`,
}

export function buildCommentPrompts(params: CommentPromptParams): {
  system: string
  user:   string
} {
  const { lead, sender, config, postContent, postAuthor, toneOverride } = params

  // Pick tone: override > config tone (mapped to comment tone) > default 'insightful'
  const commentTone: CommentTone = toneOverride ?? mapToneToComment(config.tone)

  const system = `${buildSystemCore(config, sender)}

SPECIFIC RULES FOR LINKEDIN COMMENTS:
- Maximum 1250 characters
- Must reference something SPECIFIC from the post content — not generic praise
- Must sound like it's from someone in the same industry who genuinely read the post
- Do NOT promote yourself or your company in the comment
- Do NOT add hashtags
- Do NOT use "Great post!" or "Love this!" as openers
- If mentioning the author by name, use their first name only
- Must feel organic — not like a bot comment
- Output ONLY the comment text — nothing else

TONE FOR THIS COMMENT: ${COMMENT_TONE_INSTRUCTIONS[commentTone]}`

  const truncatedPost = postContent.length > 800
    ? postContent.slice(0, 800) + '…'
    : postContent

  const user = `Write a LinkedIn comment on the following post.

Post author: ${postAuthor} (${lead.job_title} at ${lead.company})
Post content:
"${truncatedPost}"

Comment tone: ${commentTone}

Your background context (don't mention directly unless natural):
- You work in: ${config.target_industry}
- You're commenting as: ${sender.name}, ${sender.role} at ${sender.company}

Few-shot examples of CORRECT comments:

GOOD (insightful — adds value):
"The point about programme delays cascading into subcontractor insolvency is something we see constantly on groundworks packages. What's interesting is that early-warning clause adoption in NEC contracts is still surprisingly low despite this being a known risk. Has your team had success getting clients to actually use them?"

GOOD (congratulatory — specific):
"That Hinkley civils milestone is no small thing given the ground conditions on that site. The team will have earned that one. What was the trickiest element to get across the line?"

GOOD (questioning — genuine curiosity):
"Interesting position on framework pricing — do you think the shift to two-stage tendering has actually improved quality of submissions, or just added time to a process that was already front-loaded?"

BAD (generic — rejected):
"Great insights! Thanks for sharing this valuable post. Very informative!"

BAD (self-promotional — rejected):
"Love this post! At [My Company] we help civil engineers with exactly this challenge. DM me to learn more!"

Now write the comment:`

  return { system, user }
}

// ── DM PROMPT ─────────────────────────────────────────────

export interface DmPromptParams {
  lead:            LeadContext
  sender:          SenderContext
  config:          GenerationConfig
  template?:       string
  commentHistory:  CommentSummary[]
  regenInstruction?: string
}

export function buildDmPrompts(params: DmPromptParams): {
  system: string
  user:   string
} {
  const { lead, sender, config, template, commentHistory, regenInstruction } = params

  const system = `${buildSystemCore(config, sender)}

SPECIFIC RULES FOR LINKEDIN DMs:
- Maximum 1900 characters — but aim for 200–400 words (shorter DMs get more replies)
- Structure: warm opener referencing the relationship → specific value proposition → soft CTA
- The CTA must be a low-commitment ask: "worth a quick call?", "open to chatting?", "thoughts?" — NEVER "book a demo", "buy now"
- Reference the comment history naturally — you've been engaging on their content, this isn't cold
- Must feel like a continuation of the relationship, not a sudden pitch
- NEVER use "I wanted to reach out" or "I'm reaching out to" — find a more direct opener
- NEVER use "synergy", "leverage", "game-changer", "revolutionary", "disruptive"
- The tone should feel like a peer-to-peer conversation, not a sales script
- Output ONLY the message text — no subject line, no metadata`

  const leadDetails = buildLeadDetails(lead, config.personalisation_depth)
  const commentSection = buildCommentHistory(commentHistory)
  const templateSection = template
    ? `\nUser's base DM template (use as structure guide, NOT verbatim — personalise heavily):\n"${template}"\n`
    : ''

  const regenSection = regenInstruction
    ? `\nSpecific instruction for this regeneration: ${regenInstruction}\n`
    : ''

  const user = `Write a personalised LinkedIn DM for the following person.

LEAD PROFILE:
${leadDetails}

ENGAGEMENT HISTORY (your previous interactions with them):
${commentSection}${templateSection}${regenSection}

Few-shot examples of CORRECT DMs:

GOOD (natural, references engagement, soft CTA):
"Hi James,

Really glad your post on programme management got the traction it did — the point about early warning notices being underused rang true for a lot of people in the replies.

Given your background across the Balfour and BAM groundworks side, I think there's a genuine overlap with something we're working on around subcontractor risk management in NEC environments. Not trying to sell you anything — more curious whether the problem I'm seeing on our end matches what you're seeing from the main contractor side.

Worth a quick 20-minute call sometime?"

GOOD (shorter, more direct):
"Hi Sarah,

Your comment on the HS2 civils procurement piece last week stuck with me — the frustration around late design information and its knock-on to groundworks programmes is something we're trying to solve from a different angle.

I'd love to hear your perspective on it, if you're up for a brief chat?"

BAD (too long, too salesy — rejected):
"Hi Michael, I hope you're well. I wanted to reach out because I've been following your profile and I think there's a great opportunity for us to work together. At [Company] we offer a revolutionary solution that helps civil engineers like yourself increase revenue by 40% guaranteed. Would you be interested in a demo? Please let me know your availability for a call this week or next."

Now write the DM:`

  return { system, user }
}

// ── Helpers ────────────────────────────────────────────────

function buildLeadDetails(lead: LeadContext, depth: 1 | 2 | 3): string {
  const lines = [
    `Name:       ${lead.full_name} (use "${lead.first_name}" informally)`,
    `Title:      ${lead.job_title}`,
    `Company:    ${lead.company}`,
    `Industry:   ${lead.industry}`,
  ]

  if (depth >= 2) {
    if (lead.city || lead.region) {
      lines.push(`Location:   ${[lead.city, lead.region].filter(Boolean).join(', ')}`)
    }
    if (lead.seniority_level && lead.seniority_level !== 'unknown') {
      lines.push(`Seniority:  ${lead.seniority_level}`)
    }
  }

  if (depth >= 3) {
    if (lead.top_skills) {
      lines.push(`Top skills: ${lead.top_skills}`)
    }
    if (lead.recent_experience) {
      lines.push(`Recent exp: ${lead.recent_experience}`)
    }
    if (lead.notes) {
      lines.push(`Notes:      ${lead.notes}`)
    }
  }

  return lines.join('\n')
}

function buildCommentHistory(comments: CommentSummary[]): string {
  if (comments.length === 0) {
    return 'No prior engagement — this is your first direct message to them.\n'
  }

  const lines = comments.slice(0, 5).map((c, i) => {
    const date = new Date(c.posted_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
    return `${i + 1}. [${date}] Post: "${c.post_snippet?.slice(0, 80) ?? 'unknown post'}..."\n   Your comment: "${c.comment_text}"`
  })

  return lines.join('\n') + '\n'
}

function mapToneToComment(tone: ToneProfile): CommentTone {
  const map: Record<ToneProfile, CommentTone> = {
    professional:    'insightful',
    conversational:  'questioning',
    direct:          'insightful',
    warm:            'congratulatory',
  }
  return map[tone]
}
