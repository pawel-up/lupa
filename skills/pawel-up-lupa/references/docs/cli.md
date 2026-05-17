# Lupa CLI Reference

Lupa provides a lightweight, interactive Command-Line Interface to help you quickly scaffold testing environments and import agent skills into your workspace.

Unlike other frameworks, Lupa's CLI is **only for scaffolding and setup**. You execute your tests directly via your custom configuration script (e.g., `npx lupa test`), keeping the execution flow entirely within your control.

---

## `lupa init`

The `init` command interactively scaffolds your test configuration file, creates your test directories, and seeds them with example `.spec.ts` files.

```bash
npx lupa init
```

### Interactive Flow
By default, `lupa init` runs in interactive mode and will prompt you to:
1. Provide a path for the configuration file (defaults to `./lupa.config.ts`).
2. Specify the target directory for your test files (e.g., `./tests`).
3. Select which test suites you want to organize your project into (e.g., `unit`, `functional`, `e2e`).
4. Select the reporters you wish to activate (e.g., `spec`, `dot`).

### Non-Interactive / CI Usage
You can bypass the interactive prompts by providing the required flags. This is particularly useful for automated setup scripts or CI environments.

```bash
npx lupa init --config ./lupa.config.ts --test-dir ./tests --suites unit,functional --reporters spec --yes
```

**Options:**
- `--config <path>`: Path to the test configuration file.
- `--test-dir <path>`: Directory where test files will be located.
- `--suites <names>`: Comma separated list of suite names (e.g. `unit,functional`), or `"all"`, or `"none"`.
- `--reporters <names>`: Comma separated list of reporters to use.
- `-y, --yes`: Overwrite existing files without prompting for confirmation.

---

## `lupa skills`

Lupa includes built-in AI agent skills that help autonomous coding assistants (like Antigravity or GitHub Copilot) understand how to write and debug tests using the Lupa framework.

The `skills` command injects these instructions directly into your workspace's `.agents/skills` directory so your AI assistant can read them.

```bash
npx lupa skills
```

### Usage
Run the command in the root of your project. It will copy the documentation and best practices to `.agents/skills/lupa-testing`.

**Options:**
- `-y, --yes`: Overwrite an existing `lupa-testing` skills directory without prompting.