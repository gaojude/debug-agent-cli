module.exports = (page) => {
  let errorDetails = {};
  let validationResult = null;

  return {
    setup: async ({ page }) => {
      console.log('🔍 Setting up advanced error capture...\n');
      
      // Add script to page to capture errors
      await page.addInitScript(() => {
        window.__errors = [];
        window.__validationLog = [];
        
        // Capture all errors
        window.addEventListener('error', (event) => {
          window.__errors.push({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error ? event.error.stack : 'No stack trace',
            timestamp: Date.now()
          });
        }, true);
        
        // Override console.error to capture validation messages
        const originalConsoleError = console.error;
        console.error = function(...args) {
          window.__errors.push({
            type: 'console.error',
            message: args.join(' '),
            timestamp: Date.now()
          });
          return originalConsoleError.apply(console, args);
        };
      });
    },

    onBeforeEvent: async (event, { page, eventIndex }) => {
      if (event.type === 'click' && event.data.target?.text === 'Register') {
        console.log('⚡ About to click Register button...\n');
        
        // Inject debugging hooks before the click
        await page.evaluate(() => {
          // Hook into any validation functions
          if (window.handleSubmit) {
            const original = window.handleSubmit;
            window.handleSubmit = function(event) {
              window.__validationStarted = true;
              window.__handleSubmitCode = original.toString();
              
              try {
                return original.call(this, event);
              } catch (error) {
                window.__handleSubmitError = {
                  message: error.message,
                  stack: error.stack,
                  code: original.toString()
                };
                throw error;
              }
            };
          }
          
          // Hook showError if it exists
          if (window.showError) {
            const original = window.showError;
            window.showError = function(fieldId, message) {
              window.__showErrorCalled = {
                fieldId: fieldId,
                message: message,
                elementExists: !!document.getElementById(fieldId + '-error'),
                timestamp: Date.now()
              };
              window.__showErrorCode = original.toString();
              
              try {
                return original.call(this, fieldId, message);
              } catch (error) {
                window.__showErrorError = {
                  message: error.message,
                  stack: error.stack,
                  fieldId: fieldId,
                  errorMessage: message
                };
                throw error;
              }
            };
          }
        });
      }
    },

    onAfterEvent: async (event, { page, eventIndex }) => {
      if (event.type === 'click' && event.data.target?.text === 'Register') {
        console.log('📸 Capturing detailed error information...\n');
        
        await page.waitForTimeout(1000);
        
        // Extract all debugging information
        const debugData = await page.evaluate(() => {
          const result = {
            errors: window.__errors || [],
            validationStarted: window.__validationStarted || false,
            showErrorCalled: window.__showErrorCalled || null,
            handleSubmitError: window.__handleSubmitError || null,
            showErrorError: window.__showErrorError || null,
            handleSubmitCode: window.__handleSubmitCode || null,
            showErrorCode: window.__showErrorCode || null,
            formData: {},
            usernameValidation: {},
            errorElements: [],
            validationConstants: {}
          };
          
          // Get form data
          const form = document.querySelector('form');
          if (form) {
            const formData = new FormData(form);
            for (let [key, value] of formData.entries()) {
              result.formData[key] = value;
            }
          }
          
          // Check username field
          const usernameField = document.getElementById('username') || document.querySelector('[name="username"]');
          if (usernameField) {
            const value = usernameField.value;
            result.usernameValidation = {
              value: value,
              length: value.length,
              charCodes: value.split('').map(c => c.charCodeAt(0)),
              trimmedValue: value.trim(),
              trimmedLength: value.trim().length,
              'value < 3': value.length < 3,
              'value <= 3': value.length <= 3,
              'value > 3': value.length > 3,
              'value >= 3': value.length >= 3,
              'value < 8': value.length < 8,
              'value > 8': value.length > 8
            };
          }
          
          // Find any MIN_LENGTH constants
          for (let key in window) {
            if (key.includes('MIN') || key.includes('MAX') || key.includes('LENGTH')) {
              result.validationConstants[key] = window[key];
            }
          }
          
          // Get error elements
          const errorDivs = document.querySelectorAll('[id$="-error"], .error, .error-message');
          result.errorElements = Array.from(errorDivs).map(el => ({
            id: el.id,
            className: el.className,
            textContent: el.textContent,
            innerHTML: el.innerHTML,
            display: window.getComputedStyle(el).display
          }));
          
          return result;
        });
        
        // Display the captured information
        console.log('❌ ERROR ANALYSIS RESULTS:');
        console.log('=' * 60);
        
        if (debugData.errors.length > 0) {
          console.log('\n🚨 JAVASCRIPT ERRORS CAPTURED:');
          debugData.errors.forEach((error, index) => {
            console.log(`\nError #${index + 1}:`);
            console.log(`  Message: ${error.message}`);
            if (error.filename) {
              console.log(`  Location: ${error.filename}:${error.lineno}:${error.colno}`);
            }
            console.log(`  Stack Trace:\n${error.stack}`);
          });
        }
        
        if (debugData.showErrorCalled) {
          console.log('\n🔴 showError() FUNCTION CALLED:');
          console.log(`  Field ID: "${debugData.showErrorCalled.fieldId}"`);
          console.log(`  Error Message: "${debugData.showErrorCalled.message}"`);
          console.log(`  Error Element Exists: ${debugData.showErrorCalled.elementExists}`);
          
          if (!debugData.showErrorCalled.elementExists) {
            console.log('  ⚠️  ERROR: Trying to set classList on non-existent element!');
            console.log(`  Looking for element with ID: "${debugData.showErrorCalled.fieldId}-error"`);
          }
        }
        
        if (debugData.showErrorError) {
          console.log('\n💥 ERROR IN showError() FUNCTION:');
          console.log(`  Error: ${debugData.showErrorError.message}`);
          console.log(`  Field ID passed: "${debugData.showErrorError.fieldId}"`);
          console.log(`  Message passed: "${debugData.showErrorError.errorMessage}"`);
          console.log(`  Stack:\n${debugData.showErrorError.stack}`);
        }
        
        if (debugData.showErrorCode) {
          console.log('\n📝 showError() FUNCTION CODE:');
          const lines = debugData.showErrorCode.split('\n');
          lines.forEach((line, index) => {
            if (line.includes('classList')) {
              console.log(`  Line ${index + 1}: ${line.trim()} <-- classList access here`);
            } else if (line.includes('getElementById') || line.includes('querySelector')) {
              console.log(`  Line ${index + 1}: ${line.trim()} <-- Element selection here`);
            } else if (index < 15) {
              console.log(`  Line ${index + 1}: ${line.trim()}`);
            }
          });
        }
        
        if (debugData.handleSubmitCode) {
          console.log('\n📝 handleSubmit() VALIDATION LOGIC:');
          const lines = debugData.handleSubmitCode.split('\n');
          
          // Find the username validation part
          let inUsernameCheck = false;
          lines.forEach((line, index) => {
            if (line.includes('username') || inUsernameCheck) {
              if (line.includes('username')) inUsernameCheck = true;
              if (line.includes('showError') && line.includes('username')) {
                console.log(`  Line ${index + 1}: ${line.trim()} <-- Username validation error`);
                
                // Try to extract the condition
                const prevLines = lines.slice(Math.max(0, index - 5), index);
                console.log('  Previous lines (validation condition):');
                prevLines.forEach((pLine, pIndex) => {
                  if (pLine.includes('if') || pLine.includes('length') || pLine.includes('<') || pLine.includes('>')) {
                    console.log(`    ${index - 5 + pIndex + 1}: ${pLine.trim()}`);
                  }
                });
                inUsernameCheck = false;
              } else if (index < lines.length && inUsernameCheck && (line.includes('length') || line.includes('<') || line.includes('>'))) {
                console.log(`  Line ${index + 1}: ${line.trim()}`);
              }
            }
          });
        }
        
        console.log('\n📊 USERNAME VALIDATION TEST:');
        console.log(`  Input Value: "${debugData.usernameValidation.value}"`);
        console.log(`  Length: ${debugData.usernameValidation.length}`);
        console.log(`  Character codes: [${debugData.usernameValidation.charCodes.join(', ')}]`);
        console.log(`  Trimmed Value: "${debugData.usernameValidation.trimmedValue}"`);
        console.log(`  Trimmed Length: ${debugData.usernameValidation.trimmedLength}`);
        console.log('\n  Validation Checks:');
        console.log(`    length < 3: ${debugData.usernameValidation['value < 3']}`);
        console.log(`    length <= 3: ${debugData.usernameValidation['value <= 3']}`);
        console.log(`    length > 3: ${debugData.usernameValidation['value > 3']}`);
        console.log(`    length >= 3: ${debugData.usernameValidation['value >= 3']}`);
        console.log(`    length < 8: ${debugData.usernameValidation['value < 8']}`);
        console.log(`    length > 8: ${debugData.usernameValidation['value > 8']}`);
        
        if (Object.keys(debugData.validationConstants).length > 0) {
          console.log('\n  Global Constants:');
          for (let [key, value] of Object.entries(debugData.validationConstants)) {
            console.log(`    ${key}: ${value}`);
          }
        }
        
        console.log('\n🔍 ERROR ELEMENTS IN DOM:');
        debugData.errorElements.forEach(el => {
          console.log(`  Element: ${el.id || el.className}`);
          console.log(`    Text: "${el.textContent}"`);
          console.log(`    Display: ${el.display}`);
        });
        
        console.log('\n💡 FORM DATA SUBMITTED:');
        for (let [key, value] of Object.entries(debugData.formData)) {
          console.log(`  ${key}: "${value}"`);
        }
        
        errorDetails = debugData;
      }
    },

    onComplete: async ({ page }) => {
      console.log('\n' + '=' * 60);
      console.log('🎯 DEBUGGING SUMMARY');
      console.log('=' * 60);
      
      if (errorDetails.showErrorError) {
        console.log('\n❌ ROOT CAUSE IDENTIFIED:');
        console.log(`The showError() function is trying to access an element with ID "${errorDetails.showErrorCalled.fieldId}-error"`);
        console.log('but this element does not exist in the DOM, causing a "Cannot read properties of null" error.');
        console.log('\nThe validation logic incorrectly shows "Username must be at least 3 characters"');
        console.log(`even though the username "${errorDetails.formData.username}" has ${errorDetails.usernameValidation.length} characters.`);
      }
      
      return errorDetails;
    }
  };
};