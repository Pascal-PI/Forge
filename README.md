# FORGE for Windows

## Microsoft Store package

Run `pnpm install --frozen-lockfile`, then set `FORGE_STORE_IDENTITY` and `FORGE_STORE_PUBLISHER` to the package identity name and publisher from Partner Center. Set `FORGE_STORE_PUBLISHER_DISPLAY_NAME` if the Store publisher display name differs from Voriq Studios. Run `pnpm dist:store` to create the x64 AppX package in `dist/`. The package uses the FORGE icon assets in `build/appx/` and is built for Store signing during submission. Verify profile migration, backup and restore on a Store-installed build before release.

A downloadable desktop version of the supplied FORGE starter, with a private Grade 7 School Edition, real AMC 10 past-paper practice, and an AI Coach powered by GPT-6 Luna. Six learner-centered destinations remain visible—Home, School, Learn, Practice, Coach, and Progress—while secondary tools are preserved under **More**.

## New in 1.11.0: focused interactive learning

The interface now emphasizes one useful next action instead of presenting every feature at once. School Edition leads with a personalized continue card, a visible Practice → Review → Strengthen cycle, compact optional tools, and three subject paths. Activity history is collapsed until requested. Question sessions use a centered stage, clear progress rail, compact question navigation, larger answer targets, and less decorative competition for attention.

Nothing was removed: Coding, Competitions, My Plan, Projects, Review, and Achievements are available under **More**. Selecting one keeps the group open; returning to a primary destination collapses it again. The design works at desktop and 390-pixel widths and retains keyboard-visible focus.

## New in 1.10.0: Grade 7 School Edition

**School Edition** is a separate Grade 7 workspace for Mathematics, Chemistry, and English. Its 72 reviewed original questions power 5-, 10-, and 15-question smart quizzes, a timed 20-question mixed mock, answer explanations, private practice evidence, and a daily review queue built from missed concepts. Homework Help offers a Hint, Concept explanation, or Similar Example without completing the learner's original answer. The local guide works offline; **Ask GPT-6 Luna** is optional and uses the configured key. Homework text is not saved.

The workspace saves attempts and review progress on this device and includes them in JSON backups. Mastery is explicitly a practice estimate, not a school-grade prediction. There are no public rankings, and this build makes no claim of affiliation with or endorsement by a school.

## New in 1.9.0: personalized first-run journey

New profiles begin with an eight-step, locally saved setup for name, broad optional age range, goals, separate math/programming/competition experience, learning preferences, weekly availability, an optional four-question adaptive skills check, and an adjustable starting path. FORGE explains the evidence behind its suggestion without presenting a rank or mastery score, then creates an integrated first lesson and four dated starter missions. The same choices inform Home, AI lessons, Projects, AI Coach, planning, and future competition recommendations. Open **Analytics → Data and backup → Review personalization** to change them later. Existing profiles skip onboarding automatically.

## AI-selected integrated lessons (1.8.1)

In **Learn**, choose only a lesson length: 15, 25, or 40 minutes. GPT-6 Luna selects the topic and starting level from your saved AMC answers, lesson quiz results, and coding practice. Each new lesson connects a mathematical idea to a Python program through Math, Coding, and Bridge modules, then gives you a short quiz and coding challenge. With little saved evidence, it starts from a beginner-friendly baseline. Saved lessons from earlier versions remain available.

## Summit interface (1.8.0)

FORGE now has a persistent sidebar, mountain mission banner, teal/violet/gold subject cards and a shared visual style across its workspaces. Home shows your actual missions, local activity, saved focus time and earned achievements. Empty accounts start with zero counts; the interface does not invent skill percentages, public ranks or an AI online status. Your existing profile, theme and backups carry forward.

Use the search bar or **Ctrl+K** to find app pages, saved lessons, missions and project outlines locally. Arrow keys browse results; Enter opens one and Escape closes search. The profile button opens appearance and backup settings. Coding puts the selected problem next to its saved editor on wide screens, with external practice paths below.

In **Learn**, choose **Try the lesson** below the AI lesson form to explore binary search without an API request. Compare the target with the middle value, choose a half, read a hint, and try present or absent targets. This guided exercise does not modify saved scores.

The original mountain artwork was produced with the built-in image generator and is bundled at `renderer/assets/summit-hero.png`. Its production prompt is recorded in `renderer/assets/ARTWORK.md`.

## Run the app

- **FORGE-Setup-1.11.0-Windows-x64.exe** installs FORGE for your Windows account and creates Start menu and desktop shortcuts.
- **FORGE-Portable-1.11.0-Windows-x64.exe** runs without installation. Double-click it and allow a few moments for the first launch.

The app includes its runtime. Node.js, Python and a web server are not needed. Offline features need no account; AI Coach needs an OpenAI API key and internet access. Optional code runs also need internet. These builds are for 64-bit Windows. They are unsigned, so Windows may display an unrecognized-publisher warning; managed-device policies can block unsigned builds.

## Accessibility and small-screen support

The solution editor has an explicit label for assistive technology. The eleven main views were checked for named interactive controls, unique element IDs, page headings, visible keyboard focus, and horizontal overflow at a 390-pixel viewport.

The light theme includes matching AMC and achievement card surfaces, readable form labels, hints, lesson examples and status text. Solid-background text contrast was checked across the ten default views and a populated synthetic lesson in both themes; gradient-backed areas were reviewed separately. This is scoped UI verification, not a claim of complete accessibility conformance.

## Interactive Learn lessons

Open **Learn**, choose 15, 25, or 40 minutes, and select **Build my lesson**. GPT-6 Luna chooses the topic and starting level. Every new lesson includes objectives, three to five Math, Coding, and Bridge teaching modules, worked examples, exercises with walkthroughs, a three-question check, a Python challenge, and follow-up ideas. Lessons, exercise notes, quiz results, review dates, and coding drafts are saved locally. Up to three new lessons and twenty total AI requests are allowed per day.

- The next-lesson card uses unique AMC 10 questions and the latest answer for each question. It shows the sample count and labels sparse evidence as an early signal or baseline; blank responses do not count as wrong.
- Quiz results schedule a next review. A lesson can also be added to the daily plan.
- Choose **Export PowerPoint** on an open lesson to save an editable slide deck on this device. It contains the objectives, worked examples, practice prompts, quiz and answer key; practice solutions and quiz explanations are also in presenter notes. Student exercise notes and coding drafts are not exported, and export does not use the AI key.
- Choose **Read aloud** to hear the instructional text through an installed local speech voice. FORGE will not use a remote voice service; playback is unavailable if Windows has no local voice. Student exercise notes, quiz choices and answers, and coding drafts are not included in narration. Use **Stop** to cancel playback.
- New integrated lessons include Python starter code and sample inputs, but the editor saves a draft only. FORGE does not execute or grade lesson code.
- Lesson generation sends the selected duration, optional saved grade and study goal, bounded AMC topic summaries, recent lesson outcomes, self-marked coding practice, and bounded onboarding goals/preferences/diagnostic evidence. It does not send the learner's name, age, location, code drafts, full AMC answer history, or API key in the prompt.
- AI-generated teaching can still contain mistakes. FORGE checks lesson structure and verifies numeric last-digit power examples, exercises and quiz keys before saving. Check important results against another trusted source.

## Codeforces schedule

Open **Compete → Upcoming Codeforces contests → Refresh schedule** to load upcoming public contests. Times are displayed in your local timezone. Choose **Official page** to visit Codeforces, or **Track date** to add a countdown to your local competition tracker. The app uses the anonymous public contest API; it does not need a Codeforces account, API key or the credentials in the supplied project documents. Requests happen only when you ask, results are cached briefly, and recent cached data can be shown if a refresh fails. The feed does not guarantee that registration is open; check the organizer's page.

## Advent of Code progress

Open **Compete → Advent of Code tracker**, choose a year, and click a day's star button to cycle between no stars, one star and two stars. This is a manual local checklist, not a connection to an Advent of Code account or a verified completion. Day and home buttons open the corresponding official Advent of Code pages; FORGE does not copy puzzle text or solutions. Progress is included in local JSON backups.

## Focus sessions

On **Home**, choose a 25-, 40- or 75-minute preset, or use a selected mission's own duration when it is between 1 and 180 minutes. Pausing and resuming save the remaining time; completing or ending early records a local session in **Analytics**. FORGE pauses when its window loses focus and counts that interruption; resuming is always manual. It does not lock the computer or monitor other apps, screens or keystrokes. Session history stays in local progress and backups. An early-ended session is shown in history but excluded from completed focus totals.

Once a session starts, choose **Open focus mode** for a quiet view of the chosen mission, countdown and progress. Pause, resume or end the same session there. **Exit focus mode** or **Escape** returns to Home without changing the timer. Keyboard navigation stays within the focus screen; the result remains visible when a session completes or ends early. A new session never starts automatically. You can use a preset instead of a suggested mission duration.

## LeetCode and Codeforces training paths

The **Coding** view includes 18 curated starter problems across Beginner, Intermediate and Advanced paths on LeetCode and Codeforces. Cards store only problem metadata and link to the official problem pages; statements, submissions and judging remain on those platforms. Marking a problem practiced is a private self-report. **Add to plan** creates one deduplicated Coding mission. Platform difficulty is shown for reference; Codeforces ratings can change.

## Project Studio, language guide and display

**Projects** contains 27 local project outlines: three at each Beginner, Intermediate and Advanced level for Coding, Math and Competition. It selects your subject and self-rated level, then ranks the three matches by your goal and private fit votes. Each outline has a first 30-minute step and a concrete quality check; **Add starter mission** puts that specific first step into today's plan once. Its four-step skill ladder is a suggested sequence, not a measured score. Saved ideas, fit votes and recommendations stay on this device and can become daily missions; student proposals are not sent to a shared queue.

Choose **Plan project** to preview dated start, build and quality-check milestones. Pick a start date and either every day or weekdays; work blocks are at most 45 minutes and preserve the outline's total estimate. The preview adds nothing until you choose **Add missions**. One linked schedule is kept per project. Its mission checkboxes drive the tracker; completing a focus timer does not mark a mission complete.

Use **Edit** on a mission to change its name, date, duration or subject while preserving its project link. **Select for focus** chooses that milestone and suggests its duration without starting a timer. Deleted missions stay incomplete in the tracker; **Restore original mission** restores the original planned details. **Unlink project** keeps all its missions in the daily plan. Project links and edited missions are included in backups; older backups migrate to an empty link list. Export a backup before using an older release that does not understand project links.

The **Coding** view includes a broad guide to typical uses, learning curves and related directions for 17 language goals. HTML is labeled as markup and CSS as styling. These descriptions are orientation only, not current hiring, salary or job-market predictions. Remote runner availability is checked separately against the service.

Choose **System default**, **Dark** or **Light** under **Analytics → Data and backup**. System default follows the Windows color preference. Theme and progression-goal preferences are included in exported backups. Older backups receive safe defaults. FORGE also honors reduced-motion settings and adds a visible keyboard focus outline.

## Coding environments

Code drafts stay on this device. **Run remotely** submits the selected source file and standard input to Judge0 Community Edition only after you check the per-run consent box and click the button. The current service is checked for its version, network-disabled setting and available languages before each run. FORGE asks for a 5-second CPU limit, 10-second wall-clock limit, 128 MB memory limit and no network access, and allows up to 20 runs per local day. The public service stores submitted source and input; FORGE cannot control retention or guarantee deletion. Do not send secrets, passwords, personal data or private code. See [Judge0's privacy policy](https://github.com/judge0/judge0/blob/master/PRIVACY_POLICY.md).

HTML and CSS use an on-device preview with scripts, forms and external network resources blocked. The public execution service currently does not offer Racket, so FORGE blocks that option when its language list is checked. Service language availability can change; **Check service and languages** shows the current list. A completed run displays its output but does not save the source or results to your progress history.

## GPT-6 Luna AI Coach

Open **AI Coach**. Its three main actions are **Practice next**, **Plan my week**, and **Find competitions**. Add your grade, age (optional), region, interests, available daily study time and goal for more useful recommendations.

- Practice recommendations use your recorded AMC results, broad topic performance, review queue and question metadata. Exact question buttons open untimed practice. Sparse data is treated as a baseline rather than a reliable skill assessment.
- Weekly plans fit the daily time budget. Click **Add to plan** or **Add all to plan** to turn suggestions into missions; repeated clicks do not create duplicates.
- Choose USACO, LeetCode, Codeforces, YoungWonks, Hackathons, AtCoder or an organizer-backed Other target in **Prepare for a competition**. Select your self-rated competition level and coding-language preference; **Find competitions** then searches target-specific organizer domains and returns current pathways with sources, a 1–5 fit rating and an estimated difficulty. It also creates three ranked prep ideas; **Build integrated lesson** sends the chosen idea as context while GPT-6 Luna chooses a combined math and Python topic and starting level. Readiness compares your self-rating with the estimated event level and is a planning signal, not an ability score or qualification. The competition request sends the selected target, optional profile context, aggregate practice marks and coding lesson quiz summary; it does not send code drafts. Dates are shown only when supported by retrieved organizer sources. **Track date** adds an announced date to your local tracker; registration happens on the official site.
- Open a submitted or checked AMC question and select **Explain my mistake**. The coach receives the selected paper/solution pages and your working notes. With no working notes it explains the method without claiming to know your reasoning.
- In unchecked untimed practice, **Give me a hint** provides an incremental hint. Full feedback is available after checking. AI help is hidden during an active timed mock.
- Requests run only when clicked and can be canceled. The last 30 coaching responses and the profile save locally and are included in progress backups.

### Key file and privacy

Use **Choose key file** to connect an existing text file containing your OpenAI key. FORGE's main process reads it locally; the key is never sent to the renderer or included in progress backups, source ZIPs, or executable builds. The app stores only a reference to the chosen file under `%APPDATA%\FORGE\ai-settings.json`. **Disconnect** removes that reference without deleting or modifying the key file. The source build also supports `FORGE_AI_KEY_FILE` for an explicit local key-file path.

The requested model is fixed to `gpt-6-luna`; the app does not silently switch models. AI requests use the [Responses API](https://developers.openai.com/api/docs/models/gpt-6-luna) with `store: false`. Selected study context is sent to OpenAI when you request coaching; API usage is billed to the connected key. AI output is guidance. Scores and correct answer letters remain tied to the verified AMC keys.

AI Coach saves its profile/history with your progress. The key file connection is separate from backups. Other computers need their own local key-file connection.

## Real AMC 10 practice

Open **Math → Past AMC tests**. Choose from 22 complete exams from 2016–2025 (550 questions), including both spring and fall 2021. Filter by year and A/B paper.

- **Timed mock:** 25 questions in 75 minutes, with answers and solutions hidden until submission. The clock continues if you close the app. Expired sessions submit automatically when FORGE is open or next starts.
- **Untimed:** check answers individually and read the worked solutions. Checking locks your original answer so the score reflects the first response. Practice scores are labeled separately from timed scores.
- Answer sheet, flags, and working notes save automatically. Resume an unfinished paper from the library.
- Submission calculates 6 points per correct answer, 1.5 per blank, and 0 per wrong answer. Scores also appear in the competition mock history.
- A score report links each question to its paper and worked-solution page. Missed and blank questions enter the spaced-review queue in AMC Practice and Review.

Papers and solution PDFs are downloaded on demand from the [authorized LIVE by Po-Shen Loh archive](https://live.poshenloh.com/past-contests), then saved under `%APPDATA%\FORGE\AMC Papers` for offline use. Use **Save paper + solutions offline** to prepare ahead. Internet is required for the first download of each document. Failed downloads do not replace your progress.

The app distributes a catalog, factual answer keys, and page references; it does not bundle the exam PDFs. AMC problems are copyright the Mathematical Association of America. The PDF viewer uses [Mozilla PDF.js](https://mozilla.github.io/pdf.js/), licensed under Apache 2.0; its license is included in `renderer/vendor/PDFJS-LICENSE.txt`. The original quick drills remain available under **Quick original drills**.

## Analytics and achievements

The **Practice rhythm** card counts consecutive days with recorded FORGE activity and shows your longest streak. Local achievements mark private activity milestones, including 7-, 30- and 100-day streaks.

**AMC 10 score estimate** shows the median and observed range from your latest attempt on each of the last three distinct timed past papers. Untimed practice and manually entered mock scores are excluded. Under **Practice and progression timeline**, you can set an AMC score goal or a lesson-quiz goal. FORGE shows a rough time range only when there are at least three months of results with two distinct timed papers per month for AMC, or three different lesson quizzes per month, and the month-to-month trend is consistently upward. Flat, mixed or sparse results do not get a date estimate. Paper difficulty and lesson topics vary; these local estimates are planning signals, not measured ability scores or promises. Your selected goals are included in backups.

Select any month in the timeline to inspect its timed-paper scores, saved lesson checks and recorded activity days. Each paper or lesson contributes its latest result once; retakes replace the earlier result and may move it to a later month. Selecting a month changes the detail view without changing the goal estimates or saved progress. Paper titles come from the bundled AMC catalog. The detail view makes no model request and shares no data.

## Progress and backups

Progress saves automatically under `%APPDATA%\FORGE`. The installed and portable versions use the same data on the same Windows account. The portable executable does not carry your progress with it.

Use **Progress → Data and backup → Export JSON backup** (or **Ctrl+Shift+S**) to choose a backup location. Backups include School Edition attempts/reviews, AMC answers, active timer deadlines, notes, results, review stages, lessons, AI Coach history/profile, onboarding choices, and local display/progression preferences. Use **Import JSON backup** to restore or transfer progress. Cached PDFs and key-file connections are separate. Existing starter, 1.0, 1.1, 1.2 and 1.3 backups are supported. Import replaces the current workspace after confirmation. Uninstalling the app retains its saved progress. Installing 1.11.0 uses the same profile.

Coding solutions are saved drafts; the app does not automatically grade challenge correctness. Remote code is run only by explicit per-run consent. Keep FORGE in the foreground for focus time to count; minimizing or switching windows pauses the timer. The starter's missions and contest dates are editable defaults.

## Build from source

Requires Node.js 22.13 or newer, pnpm 11, internet access for dependencies, and Windows for a Windows build.

```powershell
pnpm install
pnpm start
pnpm dist
```

Build artifacts appear in `dist/`. Runtime and builder versions are pinned in `package.json` and `pnpm-lock.yaml`. The build is unsigned; public distribution under a verified publisher requires your own signing certificate.

The source includes the final renderer. `scripts/vendor-pdf.cjs` copies the pinned PDF.js viewer assets after installation. `amc-catalog.json` records each exam's source, verified 25-answer key, and indexed question/solution pages. PowerPoint exports use PptxGenJS under the MIT license; its notice is in `third-party/PPTXGENJS-LICENSE.txt`. `STARTER-README.md` preserves the original project notes.

## Desktop changes

- Sandboxed desktop window, isolated renderer, and restricted local protocol. Remote PDF requests are limited to catalog entries; the renderer cannot fetch external websites directly.
- Stable local profile, automatic code-note saving and native backup save dialog.
- Validation of imported backups before replacing progress.
- Standard edit/zoom menus, backup shortcut and dedicated FORGE icon.
- User-level Windows installer and portable executable.
- Fixed-host Judge0 remote runner with per-run consent, provider security checks, resource caps, daily limits and source-free local run metadata; sandboxed on-device HTML/CSS previews.
- On-device editable PowerPoint exports for saved lessons, with answer keys and presenter notes.

The desktop wrapper follows the [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

