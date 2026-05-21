## TODO: Future Skill Improvements

To further improve this skill for AI agents, consider adding:
- **Diagnostic Scripts (`scripts/`):** Create helper scripts (e.g., Python or Node.js) to assist agents in debugging tests. Examples include a script to run a specific test and automatically dump the full HTML fixture upon failure, or a script to parse Lupa's JSON output and summarize network requests.
- **Gotchas & Anti-Patterns (`references/troubleshooting.md`):** Expand the existing troubleshooting section into a dedicated file outlining the most common mistakes when writing Lupa tests (e.g., forgetting to `await` assertions, shadow DOM traversal issues, or trying to access Node.js APIs in the browser sandbox).
