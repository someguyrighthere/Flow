// js/pages/pricing.js
import { apiRequest, showModalMessage } from '../utils.js';

export function handlePricingPage() {
    // IMPORTANT: Replace with your actual publishable key from Stripe Dashboard
    const stripePublicKey = 'pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td'; 
    const stripe = Stripe(stripePublicKey);

    const modal = document.getElementById('register-checkout-modal-overlay');
    const form = document.getElementById('register-checkout-form');
    let selectedPlan = null; // This variable will store the plan selected for checkout

    // Get references to the specific Pro and Enterprise buttons
    const proPlanButton = document.querySelector('.choose-plan-btn[data-plan="pro"]');
    const enterprisePlanButton = document.querySelector('.choose-plan-btn[data-plan="enterprise"]');

    // Handle click for Pro and Enterprise buttons directly
    const handlePaidPlanClick = async (event) => {
        // Ensure the clicked element is a button and has a data-plan attribute
        if (!event.currentTarget || event.currentTarget.tagName !== 'BUTTON' || !event.currentTarget.dataset.plan) {
            console.error("Invalid element clicked for paid plan handler.");
            return;
        }

        selectedPlan = event.currentTarget.dataset.plan;
        
        console.log('Clicked paid plan:', selectedPlan); 

        if (localStorage.getItem('authToken')) {
            // User is already logged in, proceed to create a Stripe checkout session
            await createCheckoutSession(selectedPlan);
        } else {
            // User is not logged in, show the registration/checkout modal
            if (modal) modal.style.display = 'flex';
        }
    };

    // Attach listeners directly to the paid plan buttons
    if (proPlanButton) {
        proPlanButton.addEventListener('click', handlePaidPlanClick);
    }
    if (enterprisePlanButton) {
        enterprisePlanButton.addEventListener('click', handlePaidPlanClick);
    }
    
    // The Free plan button is an <a> tag and is handled by its href directly in HTML.
    // No JavaScript listener is needed for the free plan button now.

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
