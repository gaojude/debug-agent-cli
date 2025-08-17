# Broken Form Validation Test Site

This is a test website with intentional bugs for testing the debug-agent CLI tool.

## How to Run

### Development mode (unminified)
```bash
cd test-sites/broken-form-validation
npm install
npm start
```

### Production mode (minified/bundled with Vite)
```bash
cd test-sites/broken-form-validation
npm install
npm run serve  # Builds and serves production version
```

Or separately:
```bash
npm run build       # Creates minified build in /dist
npm run start:prod  # Serves from /dist
```

### Using Vite dev server
```bash
npm run dev  # Runs Vite dev server with HMR
```

Then open http://localhost:3000 in your browser.

## Intentional Bugs

This registration form has 6 intentional bugs:

1. **Submit button doesn't work** - Wrong event listener type ('click' instead of 'submit')
2. **Email validation is broken** - Regex missing escape for dot, accepts invalid emails like "test@domain"
3. **Password confirmation always passes** - Uses assignment (=) instead of comparison (==)
4. **Age validation is incorrect** - String comparison instead of number comparison ("9" > "18" is true)
5. **Success message doesn't show** - Typo: "classlist" instead of "classList"
6. **Input error highlighting broken** - Wrong element ID construction in showError function

## Testing with debug-agent

Run the debug-agent to record and identify these issues:

```bash
# Start the server in one terminal
cd test-sites/broken-form-validation
node server.js

# In another terminal, run debug-agent
debug-agent record http://localhost:3000
```

Try to:
- Fill out the form with valid data
- Submit the form (notice it doesn't work)
- Test various validation scenarios
- Check browser console for errors

The debug-agent should help identify why the form submission fails and highlight the validation issues.