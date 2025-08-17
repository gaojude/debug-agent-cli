const form = document.getElementById('registrationForm');
const successMessage = document.getElementById('successMessage');

// FIXED: Event listener now uses correct 'submit' event
form.addEventListener('submit', handleSubmit);

function handleSubmit(e) {
    e.preventDefault();
    
    let isValid = true;
    
    // Clear previous errors
    clearErrors();
    
    // Validate username
    const username = document.getElementById('username').value;
    if (username.length < 3) {
        showError('usernameError', 'Username must be at least 3 characters');
        isValid = false;
    }
    
    // Validate email
    const email = document.getElementById('email').value;
    // FIXED: Email regex now properly escapes the dot
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('emailError', 'Please enter a valid email address');
        isValid = false;
    }
    
    // Validate password
    const password = document.getElementById('password').value;
    if (password.length < 8) {
        showError('passwordError', 'Password must be at least 8 characters');
        isValid = false;
    }
    
    // Validate confirm password
    const confirmPassword = document.getElementById('confirmPassword').value;
    // FIXED: Using comparison operator to check if passwords match
    if (password !== confirmPassword) {
        showError('confirmPasswordError', 'Passwords do not match');
        isValid = false;
    }
    
    // Validate age
    const age = document.getElementById('age').value;
    // FIXED: Number comparison for age validation
    if (parseInt(age) < 18) {
        showError('ageError', 'You must be at least 18 years old');
        isValid = false;
    }
    
    if (isValid) {
        // FIXED: Correct classList spelling
        successMessage.classList.remove('hidden');
        form.reset();
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.classList.add('hidden');
        }, 3000);
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    
    // FIXED: Correctly getting input element by removing 'Error' suffix
    const inputElement = document.getElementById(elementId.replace('Error', ''));
    inputElement.classList.add('invalid');
}

function clearErrors() {
    const errorElements = document.querySelectorAll('.error');
    errorElements.forEach(element => {
        element.textContent = '';
    });
    
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.classList.remove('invalid');
    });
}