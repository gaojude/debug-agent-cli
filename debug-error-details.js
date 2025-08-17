module.exports = (page) => {
  let errorDetails = null;
  let validationCode = null;
  let formState = {};

  return {
    setup: async ({ page }) => {
      console.log('🔍 Setting up error detail capture...\n');
      
      // Inject error capturing into the page
      await page.evaluateOnNewDocument(() => {
        // Store original error constructor
        const OriginalError = window.Error;
        
        // Override Error to capture stack traces
        window.Error = function(...args) {
          const error = new OriginalError(...args);
          window.__lastError = {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
          };
          return error;
        };
        
        // Capture unhandled errors with full context
        window.addEventListener('error', (event) => {
          const error = event.error || {};
          window.__capturedError = {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: error.stack,
            error: error.toString(),
            timestamp: Date.now()
          };
        }, true);
        
        // Track all function calls related to validation
        window.__validationCalls = [];
      });
    },

    onBeforeEvent: async (event, { page, eventIndex }) => {
      if (event.type === 'click' && event.data.target?.text === 'Register') {
        console.log('⚡ Preparing to capture submit button click errors...\n');
        
        // Inject detailed debugging before the click
        await page.evaluate(() => {
          // Override handleSubmit or any submit-related functions
          const form = document.querySelector('form');
          if (form) {
            const originalSubmit = form.submit;
            form.submit = function(...args) {
              console.log('Form.submit called with args:', args);
              window.__formSubmitCalled = true;
              return originalSubmit.apply(this, args);
            };
            
            // Wrap all event listeners
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
              if (type === 'submit' && this.tagName === 'FORM') {
                const wrappedListener = function(event) {
                  window.__submitEventDetails = {
                    defaultPrevented: event.defaultPrevented,
                    timestamp: Date.now()
                  };
                  
                  // Capture validation function if it exists
                  if (typeof window.validateForm === 'function') {
                    window.__validateFormCode = window.validateForm.toString();
                  }
                  if (typeof window.handleSubmit === 'function') {
                    window.__handleSubmitCode = window.handleSubmit.toString();
                  }
                  
                  try {
                    return listener.call(this, event);
                  } catch (error) {
                    window.__listenerError = {
                      message: error.message,
                      stack: error.stack,
                      listenerCode: listener.toString()
                    };
                    throw error;
                  }
                };
                return originalAddEventListener.call(this, type, wrappedListener, options);
              }
              return originalAddEventListener.call(this, type, listener, options);
            };
          }
        });
      }
    },

    onAfterEvent: async (event, { page, eventIndex }) => {
      if (event.type === 'click' && event.data.target?.text === 'Register') {
        console.log('📸 Capturing error details after submit click...\n');
        
        // Wait for any errors to be thrown
        await page.waitForTimeout(500);
        
        // Extract all error details and validation code
        const debugInfo = await page.evaluate(() => {
          const results = {
            capturedError: window.__capturedError || null,
            lastError: window.__lastError || null,
            listenerError: window.__listenerError || null,
            submitEventDetails: window.__submitEventDetails || null,
            formSubmitCalled: window.__formSubmitCalled || false,
            validationFunctions: {},
            formData: {},
            validationVariables: {},
            domState: {}
          };
          
          // Get form data
          const form = document.querySelector('form');
          if (form) {
            const formData = new FormData(form);
            for (let [key, value] of formData.entries()) {
              results.formData[key] = value;
            }
          }
          
          // Capture validation-related functions from global scope
          const validationKeywords = ['validate', 'valid', 'check', 'verify', 'handle', 'submit', 'error', 'show'];
          for (let key in window) {
            if (validationKeywords.some(keyword => key.toLowerCase().includes(keyword))) {
              if (typeof window[key] === 'function') {
                results.validationFunctions[key] = {
                  code: window[key].toString(),
                  name: key
                };
              } else if (typeof window[key] !== 'object' || window[key] === null) {
                results.validationVariables[key] = window[key];
              }
            }
          }
          
          // Capture validation.js content if it's loaded
          const scripts = Array.from(document.querySelectorAll('script[src*="validation"]'));
          results.validationScripts = scripts.map(s => s.src);
          
          // Get the actual validation code from the page
          if (window.handleSubmit) {
            results.validationFunctions.handleSubmit = window.handleSubmit.toString();
          }
          if (window.showError) {
            results.validationFunctions.showError = window.showError.toString();
          }
          if (window.clearErrors) {
            results.validationFunctions.clearErrors = window.clearErrors.toString();
          }
          
          // Capture DOM state for error elements
          const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"]');
          results.domState.errorElements = Array.from(errorElements).map(el => ({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            textContent: el.textContent,
            display: window.getComputedStyle(el).display,
            visibility: window.getComputedStyle(el).visibility
          }));
          
          // Get username field details
          const usernameField = document.querySelector('#username') || document.querySelector('[name="username"]');
          if (usernameField) {
            results.domState.usernameField = {
              value: usernameField.value,
              length: usernameField.value.length,
              minLength: usernameField.minLength,
              maxLength: usernameField.maxLength,
              required: usernameField.required,
              pattern: usernameField.pattern,
              validity: {
                valid: usernameField.validity.valid,
                valueMissing: usernameField.validity.valueMissing,
                tooShort: usernameField.validity.tooShort,
                tooLong: usernameField.validity.tooLong,
                patternMismatch: usernameField.validity.patternMismatch
              }
            };
          }
          
          return results;
        });
        
        // Parse and display the error with context
        if (debugInfo.capturedError || debugInfo.lastError || debugInfo.listenerError) {
          console.log('❌ ERROR CAPTURED!\n');
          console.log('=' * 60);
          
          const error = debugInfo.capturedError || debugInfo.lastError || debugInfo.listenerError;
          console.log('Error Message:', error.message);
          console.log('Error Location:', error.filename ? `${error.filename}:${error.lineno}:${error.colno}` : 'Unknown');
          console.log('\nStack Trace:');
          console.log(error.stack);
          
          // Extract code context from validation functions
          console.log('\n📝 VALIDATION CODE FOUND:');
          console.log('-' * 40);
          
          for (let [name, func] of Object.entries(debugInfo.validationFunctions)) {
            console.log(`\nFunction: ${name}`);
            console.log('Code:');
            
            // Parse the function to find the error line
            const codeLines = func.code ? func.code.split('\n') : [];
            if (error.message.includes('classList') && func.code && func.code.includes('classList')) {
              console.log('⚠️  This function contains the error!');
              
              // Find the specific line with classList
              codeLines.forEach((line, index) => {
                if (line.includes('classList')) {
                  console.log(`Line ${index + 1}: ${line.trim()} <-- ERROR HERE`);
                  
                  // Try to extract variable names from the line
                  const varMatch = line.match(/(\w+)\.classList/);
                  if (varMatch) {
                    console.log(`  Variable "${varMatch[1]}" is null!`);
                  }
                } else if (index < 10) { // Show first 10 lines for context
                  console.log(`Line ${index + 1}: ${line.trim()}`);
                }
              });
            } else {
              // Show first 5 lines of other functions
              codeLines.slice(0, 5).forEach((line, index) => {
                console.log(`Line ${index + 1}: ${line.trim()}`);
              });
              if (codeLines.length > 5) {
                console.log('... (truncated)');
              }
            }
          }
          
          console.log('\n📊 FORM STATE AT ERROR:');
          console.log('-' * 40);
          console.log('Form Data:', debugInfo.formData);
          
          if (debugInfo.domState.usernameField) {
            console.log('\nUsername Field Details:');
            console.log(`  Value: "${debugInfo.domState.usernameField.value}"`);
            console.log(`  Length: ${debugInfo.domState.usernameField.length} characters`);
            console.log(`  HTML5 Validity:`, debugInfo.domState.usernameField.validity);
            console.log(`  Attributes:`, {
              minLength: debugInfo.domState.usernameField.minLength,
              maxLength: debugInfo.domState.usernameField.maxLength,
              required: debugInfo.domState.usernameField.required,
              pattern: debugInfo.domState.usernameField.pattern
            });
          }
          
          console.log('\n🔍 ERROR ELEMENTS IN DOM:');
          debugInfo.domState.errorElements.forEach(el => {
            if (el.textContent.trim()) {
              console.log(`  ${el.tagName}#${el.id || '(no-id)'}.${el.className || '(no-class)'}: "${el.textContent.trim()}"`);
              console.log(`    Display: ${el.display}, Visibility: ${el.visibility}`);
            }
          });
          
          console.log('\n💡 VALIDATION VARIABLES:');
          for (let [key, value] of Object.entries(debugInfo.validationVariables)) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
          
          errorDetails = debugInfo;
        }
        
        // Also capture the actual error by evaluating validation with username
        const validationTest = await page.evaluate(() => {
          const username = 'judegao';
          const results = {
            username: username,
            length: username.length,
            validationChecks: {}
          };
          
          // Test common validation patterns
          results.validationChecks['length < 3'] = username.length < 3;
          results.validationChecks['length <= 3'] = username.length <= 3;
          results.validationChecks['length > 3'] = username.length > 3;
          results.validationChecks['length >= 3'] = username.length >= 3;
          
          // Check if there's a minimum length variable
          if (typeof window.MIN_USERNAME_LENGTH !== 'undefined') {
            results.minLength = window.MIN_USERNAME_LENGTH;
            results.validationChecks[`length < ${window.MIN_USERNAME_LENGTH}`] = username.length < window.MIN_USERNAME_LENGTH;
            results.validationChecks[`length >= ${window.MIN_USERNAME_LENGTH}`] = username.length >= window.MIN_USERNAME_LENGTH;
          }
          
          return results;
        });
        
        console.log('\n🧪 VALIDATION LOGIC TEST:');
        console.log(`Username: "${validationTest.username}" (${validationTest.length} chars)`);
        console.log('Validation Checks:');
        for (let [check, result] of Object.entries(validationTest.validationChecks)) {
          console.log(`  ${check}: ${result} ${result ? '✓' : '✗'}`);
        }
        if (validationTest.minLength) {
          console.log(`  MIN_USERNAME_LENGTH variable: ${validationTest.minLength}`);
        }
      }
    },

    onComplete: async ({ page }) => {
      console.log('\n' + '=' * 60);
      console.log('📊 ERROR DEBUGGING COMPLETE');
      console.log('=' * 60);
      
      if (errorDetails) {
        return {
          errorFound: true,
          error: errorDetails.capturedError || errorDetails.lastError || errorDetails.listenerError,
          formData: errorDetails.formData,
          validationFunctions: Object.keys(errorDetails.validationFunctions),
          recommendation: 'The error "Cannot read properties of null (reading \'classList\')" indicates that the code is trying to access .classList on a null element. This typically happens when document.getElementById() or querySelector() returns null because the element doesn\'t exist.'
        };
      }
      
      return {
        errorFound: false,
        message: 'No JavaScript errors captured during form submission'
      };
    }
  };
};