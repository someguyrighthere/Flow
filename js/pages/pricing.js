// js/pages/pricing.js
import { apiRequest, showModalMessage } from '../utils.js';

export function handlePricingPage() {
    // IMPORTANT: Replace with your actual publishable key from Stripe Dashboard
    // This key is safe to be in client-side code.
    const stripePublicKey = 'pk_test_51PVAzL07SADx7iWaKjDxtvJ9nOq86I0I74UjKqS8WvU4S1aQ9aL7xHl2D5bJz5Uo4lB3t5kYmQ8eX3eI00O5pP5bB9'; 
    const stripe = Stripe(stripePublicKey);

    const modal = document.getElementById('register-checkout-modal-overlay');
    const form = document.getElementById('register-checkout-form');
    let selectedPlan = null;

    // Attach event listener to all buttons with the 'choose-plan-btn' class
    document.querySelectorAll('.choose-plan-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            // Get the 'data-plan-id' attribute from the clicked button
            selectedPlan = event.target.dataset.planId;
            
            // --- DEBUGGING LINE: Log the value of selectedPlan ---
            console.log('Clicked plan:', selectedPlan); 
            // --- END DEBUGGING LINE ---

            // LOGIC FOR FREE PLAN:
            // If the selected plan is 'free', redirect directly to registration.
            // This bypasses the Stripe checkout flow for free users.
            // We specifically removed the showModalMessage here to avoid the "modal element not found" error
            // that occurred when showModalMessage was called too early or in a conflicting context.
            if (selectedPlan === 'free') {
                window.location.href = '/register.html'; // Direct redirect
                return; // Crucial: Stop further execution in this event listener
            }

            // LOGIC FOR PAID PLANS:
            // If a paid plan is selected (i.e., selectedPlan is not 'free'),
            // then proceed with the Stripe-related logic.
            if (localStorage.getItem('authToken')) {
                // User is already logged in, proceed to create a Stripe checkout session
                await createCheckoutSession(selectedPlan);
            } else {
                // User is not logged in, show the registration/checkout modal.
                // This modal will handle registration and then proceed to checkout.
                if (modal) modal.style.display = 'flex';
            }
        });
    });

    // Handle submission of the registration form within the checkout modal
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('register-checkout-error-message');
            errorEl.textContent = '';
            errorEl.style.display = 'none'; // Hide error message initially

            const companyName = document.getElementById('reg-co-name').value;
            const fullName = document.getElementById('reg-full-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            try {
                // Step 1: Register the new company and user via API
                await apiRequest("POST", "/api/register", { companyName, fullName, email, password });

                // Step 2: Log the newly registered user in to get an auth token
                const loginData = await apiRequest("POST", "/api/login", { email, password });
                if (!loginData.token) throw new Error("Login failed after registration.");
                localStorage.setItem("authToken", loginData.token);
                localStorage.setItem("userRole", loginData.role);
                localStorage.setItem("userId", loginData.userId); // Store user ID for later use

                // Step 3: Proceed to create the Stripe checkout session for the selected paid plan
                await createCheckoutSession(selectedPlan);

            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.style.display = 'block'; // Show error message
                console.error('Registration/Checkout error:', error);
            }
        });
    }
    
    // Handle the cancel button click on the registration/checkout modal
    const cancelBtn = document.getElementById('reg-checkout-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none'; // Hide the modal
        });
    }

    /**
     * Creates a Stripe Checkout Session on the backend and redirects the user.
     * @param {string} plan The ID of the plan ('pro' or 'enterprise').
     */
    async function createCheckoutSession(plan) {
        try {
            // Make an API request to your backend to create the Stripe session
            const session = await apiRequest('POST', '/api/create-checkout-session', { plan });
            if (session && session.id) {
                // If session is successfully created, redirect the user to Stripe Checkout
                await stripe.redirectToCheckout({ sessionId: session.id });
            } else {
                // Display an error if the session ID is missing
                showModalMessage('Could not initiate checkout session. Please try again.', true);
            }
        } catch (error) {
            console.error('Error creating checkout session:', error);
            // Display a user-friendly error message
            showModalMessage('Could not initiate checkout. Please try again.', true);
        }
    }
}
