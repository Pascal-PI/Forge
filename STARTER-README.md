# FORGE — Personal Developer & Competition Command Center (v0.1)

A standalone responsive HTML/CSS/JavaScript prototype with a daily plan, coding prompts, original math quizzes, competition countdowns, an AMC 10 mock-score logger, error review, a focus timer and insights.

## Get started

Open `index.html` in a modern desktop or mobile browser. No dependencies, account, or server setup are required.

The initial plan is a suggested starter schedule, **not** imported scores or activity. You can add and delete tasks and competitions.

## Saving your progress

This prototype uses browser `localStorage`. Progress is not synced across devices; browser or site data deletion can erase it. Use **Insights → Export JSON backup** regularly, and **Import JSON backup** to restore it. Local storage policies can vary when running an HTML file directly; hosting it on a normal web origin can help ensure consistent persistence.

## Features and limitations

- 7 sections: Today, Plan, Coding, Math, Contests, Mistakes, Insights
- Interactive math questions with explanations, tracking, and scheduled redo stages (1, then 3, then 6 days)
- Code solution editor with Python, C++ and JavaScript note storage; **does not execute, grade, or securely run code**
- Timed focus sessions (25, 40, or 75 minutes), running while this page remains open
- Competition countdowns and manual AMC 10 mock score calculations
- Activity metrics and backup import/export

For a production version, add authentication, cloud database, test-case judging, integrations with contest platforms (where allowed), and secure syncing.
