import { apiRequest, showModalMessage } from '../utils.js';

export function handlePricingPage() {
    // IMPORTANT: Replace with your actual publishable key from Stripe Dashboard
    const stripePublicKey = 'pk_test_51PVAzL07SADx7iWaKjDxtvJ9nOq86I0I74UjKqS8WvU4S1aQ9aL7xHl2D5bJz5Uo4lB3t5kYmQ8eX3eI00O5pP5bB9'; 
    const stripe = Stripe(stripePublicKey);

    const modal = document.getElementById('register-checkout-modal-overlay');
    const form = document.getElementById('register-checkout-form');
    let selectedPlan = null;

    document.querySelectorAll('.choose-plan-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            selectedPlan = event.target.dataset.planId;
            
            if (selectedPlan === 'free') {
                window.location.href = '/register.html';
                return;
            }

            if (localStorage.getItem('authToken')) {
                // User is already logged in, proceed to checkout
                await createCheckoutSession(selectedPlan);
            } else {
                // User is not logged in, show the registration modal
                if (modal) modal.style.display = 'flex';
            }
        });
    });

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
                // Step 1: Register the new company and user
                await apiRequest("POST", "/api/register", { companyName, fullName, email, password });

                // Step 2: Log the new user in to get an auth token
                const loginData = await apiRequest("POST", "/api/login", { email, password });
                if (!loginData.token) throw new Error("Login failed after registration.");
                localStorage.setItem("authToken", loginData.token);
                localStorage.setItem("userRole", loginData.role);
                localStorage.setItem("userId", loginData.userId); // Ensure userId is stored

                // Step 3: Proceed to checkout
                await createCheckoutSession(selectedPlan);

            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.style.display = 'block'; // Show error message
                console.error('Registration/Checkout error:', error);
            }
        });
    }
    
    const cancelBtn = document.getElementById('reg-checkout-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }

    async function createCheckoutSession(plan) {
        try {
            const session = await apiRequest('POST', '/api/create-checkout-session', { plan });
            if (session && session.id) {
                // Redirect to Stripe Checkout
                await stripe.redirectToCheckout({ sessionId: session.id });
            } else {
                // Use showModalMessage instead of alert
                showModalMessage('Could not initiate checkout session. Please try again.', true);
            }
        } catch (error) {
            console.error('Error creating checkout session:', error);
            // Use showModalMessage instead of alert
            showModalMessage('Could not initiate checkout. Please try again.', true);
        }
    }
}
