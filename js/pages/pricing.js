import { apiRequest } from '../utils.js';

export function handlePricingPage() {
    const stripePublicKey = 'pk_test_51PVAzL07SADx7iWaKjDxtvJ9nOq86I0I74UjKqS8WvU4S1aQ9aL7xHl2D5bJz5Uo4lB3t5kYmQ8eX3eI00O5pP5bB9'; // It's safe to expose the publishable key
    const stripe = Stripe(stripePublicKey);

    document.querySelectorAll('.choose-plan-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const plan = event.target.dataset.plan;
            
            // If the user is not logged in, redirect them to log in or register.
            // Pass the selected plan in the URL so we can resume after login.
            if (!localStorage.getItem('authToken')) {
                window.location.href = `/register.html?plan=${plan}`; // Redirect to register, can be changed to login
                return;
            }

            // If the user is logged in, create a checkout session.
            try {
                const session = await apiRequest('POST', '/api/create-checkout-session', { plan });
                if (session && session.id) {
                    await stripe.redirectToCheckout({ sessionId: session.id });
                } else {
                    alert('Could not initiate checkout session.');
                }
            } catch (error) {
                console.error('Error creating checkout session:', error);
                alert('Could not initiate checkout. Please try again.');
            }
        });
    });
}