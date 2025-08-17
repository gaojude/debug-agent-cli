module.exports = (page) => {
  const errors = [];
  const consoleMessages = [];
  const networkErrors = [];
  let formData = {};
  let submitAttempted = false;
  let pageNavigated = false;

  return {
    setup: async ({ page }) => {
      console.log('🔍 Starting form submission debugging...\n');
      
      // Capture console messages
      page.on('console', msg => {
        const entry = {
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        };
        consoleMessages.push(entry);
        
        if (msg.type() === 'error') {
          console.log(`❌ Console Error: ${msg.text()}`);
        }
      });

      // Capture page errors
      page.on('pageerror', error => {
        errors.push({
          message: error.message,
          stack: error.stack
        });
        console.log(`❌ Page Error: ${error.message}`);
      });

      // Monitor network requests
      page.on('request', request => {
        if (request.method() === 'POST' || request.method() === 'PUT') {
          console.log(`📤 ${request.method()} Request to: ${request.url()}`);
        }
      });

      // Monitor network responses
      page.on('response', response => {
        if (response.status() >= 400) {
          networkErrors.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText()
          });
          console.log(`❌ Network Error: ${response.status()} ${response.statusText()} - ${response.url()}`);
        }
      });

      // Monitor navigation
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
          pageNavigated = true;
          console.log(`📍 Navigated to: ${frame.url()}`);
        }
      });
    },

    onBeforeEvent: async (event, { page, eventIndex }) => {
      // Track form field values
      if (event.type === 'input') {
        formData[event.data.name || event.data.id] = event.data.value;
        console.log(`📝 Form field "${event.data.name || event.data.id}": "${event.data.value}"`);
      }
    },

    onAfterEvent: async (event, { page, eventIndex }) => {
      // When submit button is clicked
      if (event.type === 'click' && event.data.target?.text === 'Register') {
        submitAttempted = true;
        console.log('\n🎯 Submit button clicked!');
        console.log('Form data at submission:', formData);
        
        // Wait a bit to see if anything happens
        await page.waitForTimeout(2000);
        
        // Check for validation errors in the DOM
        const validationErrors = await page.evaluate(() => {
          const errors = [];
          
          // Check for HTML5 validation messages
          const inputs = document.querySelectorAll('input');
          inputs.forEach(input => {
            if (!input.validity.valid) {
              errors.push({
                field: input.name || input.id,
                validationMessage: input.validationMessage,
                validity: {
                  valueMissing: input.validity.valueMissing,
                  typeMismatch: input.validity.typeMismatch,
                  patternMismatch: input.validity.patternMismatch,
                  tooShort: input.validity.tooShort,
                  tooLong: input.validity.tooLong,
                  rangeUnderflow: input.validity.rangeUnderflow,
                  rangeOverflow: input.validity.rangeOverflow,
                  stepMismatch: input.validity.stepMismatch,
                  badInput: input.validity.badInput,
                  customError: input.validity.customError
                }
              });
            }
          });
          
          // Check for visible error messages
          const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"], [id*="error"]');
          errorElements.forEach(elem => {
            if (elem.textContent.trim()) {
              errors.push({
                type: 'visible_error',
                text: elem.textContent.trim(),
                element: elem.tagName,
                class: elem.className,
                id: elem.id
              });
            }
          });
          
          return errors;
        });
        
        if (validationErrors.length > 0) {
          console.log('\n⚠️ Validation errors found:');
          validationErrors.forEach(error => {
            if (error.field) {
              console.log(`  Field "${error.field}": ${error.validationMessage}`);
              if (error.validity) {
                const issues = Object.entries(error.validity)
                  .filter(([key, value]) => value === true)
                  .map(([key]) => key);
                if (issues.length > 0) {
                  console.log(`    Issues: ${issues.join(', ')}`);
                }
              }
            } else if (error.type === 'visible_error') {
              console.log(`  Visible error: "${error.text}"`);
            }
          });
        }
        
        // Check form submission handler
        const formInfo = await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) {
            const submitButton = document.querySelector('button[type="submit"], button:contains("Register"), input[type="submit"]');
            return {
              hasForm: true,
              formAction: form.action || 'none',
              formMethod: form.method || 'GET',
              hasOnSubmit: !!form.onsubmit,
              formNoValidate: form.noValidate,
              buttonType: submitButton?.type || 'unknown',
              buttonDisabled: submitButton?.disabled || false,
              eventListeners: {
                form: {
                  submit: typeof form.onsubmit === 'function'
                },
                button: {
                  click: submitButton ? typeof submitButton.onclick === 'function' : false
                }
              }
            };
          }
          return { hasForm: false };
        });
        
        console.log('\n📋 Form configuration:');
        console.log('  Form found:', formInfo.hasForm);
        if (formInfo.hasForm) {
          console.log('  Action:', formInfo.formAction);
          console.log('  Method:', formInfo.formMethod);
          console.log('  Has onSubmit handler:', formInfo.hasOnSubmit);
          console.log('  NoValidate:', formInfo.formNoValidate);
          console.log('  Button type:', formInfo.buttonType);
          console.log('  Button disabled:', formInfo.buttonDisabled);
          console.log('  Event listeners:', formInfo.eventListeners);
        }
        
        // Check if form is actually submitting
        const isSubmitting = await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) {
            // Try to check if default was prevented
            let defaultPrevented = false;
            const testEvent = new Event('submit', { cancelable: true });
            form.addEventListener('submit', (e) => {
              if (e.defaultPrevented) defaultPrevented = true;
            }, { once: true });
            form.dispatchEvent(testEvent);
            return !defaultPrevented;
          }
          return false;
        });
        
        console.log('  Form would submit:', isSubmitting);
        
        // Take a screenshot after submit attempt
        await page.screenshot({ 
          path: 'form-after-submit.png',
          fullPage: true 
        });
        console.log('\n📸 Screenshot saved: form-after-submit.png');
      }
    },

    onComplete: async ({ page }) => {
      console.log('\n' + '='.repeat(60));
      console.log('📊 DEBUGGING SUMMARY');
      console.log('='.repeat(60));
      
      const summary = {
        formData: formData,
        submitAttempted: submitAttempted,
        pageNavigated: pageNavigated,
        finalUrl: page.url(),
        consoleErrors: consoleMessages.filter(m => m.type === 'error'),
        pageErrors: errors,
        networkErrors: networkErrors,
        totalConsoleMessages: consoleMessages.length
      };
      
      console.log('\n✅ Form Data Collected:');
      Object.entries(formData).forEach(([key, value]) => {
        console.log(`  ${key}: "${value}"`);
      });
      
      console.log(`\n🎯 Submit Attempted: ${submitAttempted}`);
      console.log(`📍 Page Navigated: ${pageNavigated}`);
      console.log(`🔗 Final URL: ${page.url()}`);
      
      if (consoleMessages.filter(m => m.type === 'error').length > 0) {
        console.log('\n❌ Console Errors:');
        consoleMessages.filter(m => m.type === 'error').forEach(err => {
          console.log(`  - ${err.text}`);
        });
      }
      
      if (errors.length > 0) {
        console.log('\n❌ Page Errors:');
        errors.forEach(err => {
          console.log(`  - ${err.message}`);
        });
      }
      
      if (networkErrors.length > 0) {
        console.log('\n❌ Network Errors:');
        networkErrors.forEach(err => {
          console.log(`  - ${err.status} ${err.statusText} at ${err.url}`);
        });
      }
      
      if (!pageNavigated && submitAttempted) {
        console.log('\n⚠️ ISSUE DETECTED: Form submit button was clicked but page did not navigate.');
        console.log('Possible causes:');
        console.log('  1. JavaScript validation preventing submission');
        console.log('  2. HTML5 validation errors');
        console.log('  3. Missing or incorrect form action');
        console.log('  4. JavaScript error in submit handler');
        console.log('  5. Form submission prevented by event.preventDefault()');
      }
      
      return summary;
    }
  };
};