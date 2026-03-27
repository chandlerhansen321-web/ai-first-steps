# AI First Steps — Project Context

## What this is
Interactive educational site teaching non-coders how to build AI apps. Two-tab experience:

- **Track 1 — "Build with AI"**: 9-step wizard (steps 0–8). Steps 0–3 = curriculum (concepts, prompt engineering, quiz checkpoint). Step 4 = project picker (7 options). Steps 5–7 = interactive Claude Code sessions + live AI preview. Step 8 = launch screen with code export.
- **Track 2 — "Claude Code"**: Scrollable reference guide with sidebar nav.

## Stack
- No framework, no build step — pure HTML/CSS/JS
- Live AI via SSE streaming to `/api/chat` (Vercel serverless function)
- Deployed to Vercel: **https://ai-first-steps-self.vercel.app**
- `ANTHROPIC_API_KEY` set in Vercel env (production)

## Files
```
index.html          # HTML structure (~1740 lines)
styles.css          # All CSS (~3530 lines)
app.js              # All JavaScript (~1190 lines)
api/chat.js         # Vercel SSE endpoint → claude-sonnet-4-20250514
package.json        # anthropic SDK dependency
vercel.json         # maxDuration: 30 for api/chat.js
.vercel/            # Vercel project link (prj_giBVAapqxM9PFa0sAN6ciXn7zaee)
```

## CSS design system
```css
--cream / --ink / --accent (#c2410c)
--sans: Inter  --serif: Lora  --mono: Fira Code
[data-theme="dark"]  /* toggled via localStorage */
```

## JavaScript architecture

### State (top of app.js)
```js
var currentStep = 0;
var selectedProject = null;   // 'journal' | 'summarizer' | 'rewriter' | 'freeform' | 'landingpage' | 'socialmedia' | 'calculator'
var customPrompt = null;       // user-edited system prompt (step 6)
var storedSession1 = null;     // saved CC session after step 5
var storedSession2 = null;     // saved CC session after step 6
var unlockedConcepts = new Set();
var chatHistories = {};        // conversation history per containerId
var tooltipInput, tooltipOverlay;  // cached on DOMContentLoaded
```

### Key features
- **Progress persistence**: `saveProgress()` / `loadProgress()` / `resumeProgress()` via localStorage. Resumes on page load with banner.
- **Conversation history**: `chatHistories` stores multi-turn conversations per chat instance. `sendChat()` sends full history to API.
- **Quiz checkpoints**: `checkQuiz()` on step 3 with knowledge-check questions.
- **Code export**: `exportProjectCode()` generates downloadable .js file with user's system prompt.
- **Analytics events**: `trackEvent()` fires custom events for step_reached, project_selected, demo_used, code_exported, track_switched.
- **7 project templates**: journal, summarizer, rewriter, freeform, landingpage, socialmedia, calculator.

### Key functions
| Function | Purpose |
|---|---|
| `goToStep(n)` | Wizard navigation + saveProgress + trackEvent |
| `selectProject(id)` | Sets project, resets sessions/prompt, saves progress |
| `populateBuildStep(n)` | Populates steps 5/6/7; restores saved sessions on revisit |
| `populateLaunch()` | Step 8; guards against re-rendering live app |
| `streamFromClaude(msgOrHistory, sys, ...)` | SSE streaming — accepts string or message array |
| `sendChat(id)` | Chat with conversation history (journal/freeform) |
| `runGenerator(id, projectId)` | Landing page / calculator — streams HTML into sandboxed iframe |
| `runSocialMedia(id)` | Social media — streams posts, renders as platform cards |
| `runSummarizer(id)` | Summarizer — calls `renderBullets` with rAF debounce |
| `runTool(id)` | Rewriter — streams into stable `textNode` |
| `checkQuiz(quizId, btn, isCorrect)` | Quiz checkpoint handler |
| `exportProjectCode()` | Generates and downloads project .js file |
| `trackEvent(name, props)` | Vercel Web Analytics custom events |

### API endpoint (api/chat.js)
Supports both single message and conversation history:
```js
// Single message
{ message: "...", systemPrompt: "...", maxTokens: 1024 }
// Conversation history
{ messages: [{role: "user", content: "..."}, ...], systemPrompt: "...", maxTokens: 1024 }
```

### CC session item types
```js
{ type: 'user', text: '...' }
{ type: 'tool', verb: '...', file: '...', diffs: [{ add: bool, code: '...' }] }
{ type: 'done', text: '...' }
```

## Deployment
```bash
vercel --prod    # deploy from /Users/chandlerhansen/Downloads/Personal/ai-first-steps/
```
No git repo. Vercel project linked via `.vercel/project.json`.

## Known quirks / decisions
- `opts.param` in `makeBuild2Session` for the rewriter/emaildrafter is raw HTML for two colored params — intentional, hardcoded only
- `renderBullets` uses rAF debounce (`_renderBulletsRAF`) to batch streaming chunks
- `escapeAttr` uses backslash-escaping for inline `onclick` attributes
- Step 7 and step 8 both guard `renderLiveApp` with `!container.children.length` to preserve chat on revisit
- Sidebar scroll tracking uses `claudeNavMap` for O(1) intersection lookups
- New projects: landingpage/calculator use generator UI (textarea + iframe preview), socialmedia uses generator UI with parsed platform cards
- `extractHtml()` strips markdown code fences from Claude's response before injecting into iframe
- Generator projects use 4096 maxTokens via optional 6th param to `streamFromClaude()`
