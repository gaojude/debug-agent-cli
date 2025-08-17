# Test Sites for debug-agent

This directory contains test websites with intentional bugs to validate the debug-agent CLI's ability to identify and help fix issues.

## Architecture

Each test site is isolated in its own directory with:
- Self-contained HTML/CSS/JS files
- Its own mini dev server (no shared dependencies)
- Package.json for easy startup
- README documenting the intentional bugs

This approach ensures:
- **Isolation**: Test sites don't interfere with the main CLI
- **Portability**: Each test can run independently
- **Simplicity**: No complex build processes or frameworks
- **Reproducibility**: Bugs are consistent and documented

## Available Test Sites

### 1. broken-form-validation
A registration form with multiple validation bugs including event handling issues, regex errors, and logic mistakes.

```bash
cd broken-form-validation
npm start
```

## Adding New Test Sites

To add a new test site:

1. Create a new directory: `test-sites/your-test-name/`
2. Add your HTML/CSS/JS files with intentional bugs
3. Create a simple Node.js server (copy from broken-form-validation)
4. Add a package.json with start script
5. Document the bugs in a README

## Best Practices

- Keep bugs realistic (common mistakes developers make)
- Make bugs discoverable through normal user interaction
- Include a mix of JavaScript, CSS, and logic errors
- Ensure the site is visually complete (bugs shouldn't make it look unfinished)
- Document expected vs actual behavior clearly