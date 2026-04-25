# `.claude/`

Claude Code project resources. See [CLAUDE.md](../CLAUDE.md) for the canonical coding guide.

## Layout

```
.claude/
├── settings.json              # Shared permissions / config (committed)
├── settings.local.json        # Personal overrides (gitignored)
├── README.md                  # This file
├── commands/                  # Slash commands
│   ├── audit.md               # /audit — code-smell pass on changed files
│   └── ship.md                # /ship — pre-commit checklist + commit msg
├── agents/                    # Subagent definitions
│   └── code-reviewer.md       # Read-only senior reviewer
├── skills/                    # On-demand workflows
│   ├── add-api-endpoint/      # Adding a backend route
│   └── add-page-module/       # Adding a new feature tab
└── memory/                    # Imported context snippets
    └── architecture.md        # Data/auth/routing flow reference
```

## Conventions

- **Keep it minimal.** Don't add a skill/command for one-off tasks.
- **Update `CLAUDE.md` first** for any rule that should always apply. Use skills for *specific* workflows.
- **Personal config** (model preferences, extra `allow` rules) goes in `settings.local.json`, which is gitignored.

## Importing into CLAUDE.md

Claude Code supports `@` imports. To pull architecture notes into the always-on context, add to `CLAUDE.md`:

```md
@.claude/memory/architecture.md
```

Don't import everything — context budget matters.
