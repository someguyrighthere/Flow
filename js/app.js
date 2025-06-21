<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pricing - Flow Business Suite</title>
    <link rel="stylesheet" href="css/style.min.css">
    <link rel="stylesheet" href="css/theme.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Fredoka+One&display=swap" rel="stylesheet">
    <style>
        /* ... existing styles ... */
    </style>
</head>
<body>
    <div class="background-animation"></div>
    <div class="container">
        <header class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center;">
            <a href="dashboard.html" style="text-decoration: none;"><h1 class="app-title">Flow Business Suite</h1></a>
            <a href="login.html" class="btn btn-secondary">Log In</a>
        </header>
        <nav class="main-nav">
            <a href="pricing.html" class="active">Pricing</a>
        </nav>
        <section class="pricing-header">
            <h2>Find the perfect plan for your business</h2>
            <p>Simple, employee-based pricing for the entire Flow Business Suite.</p>
        </section>
        <section class="pricing-grid">
            <div class="pricing-card">
                <div class="pricing-card-header"><h3>Free</h3><p class="price">$0</p><p class="price-note">per month</p></div>
                <ul class="features-list">
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>Up to 5 Employees</li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>All Features Included</li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>Community Support</li>
                </ul>
                <button class="btn btn-secondary" id="free-plan-btn" data-plan-id="free" style="width: 100%;">Current Plan</button>
            </div>
            <div class="pricing-card highlight">
                <div class="pricing-card-header"><h3>Pro</h3><p class="price">$29</p><p class="price-note">per month</p></div>
                <ul class="features-list">
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>Up to 100 Employees</li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>All Features Included</li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>Priority Email Support</li>
                </ul>
                <button id="pro-plan-btn" class="btn btn-primary" data-plan-id="pro" style="width: 100%;">Choose Pro</button>
            </div>
            <div class="pricing-card">
                <div class="pricing-card-header"><h3>Enterprise</h3><p class="price">$79</p><p class="price-note">per month</p></div>
                <ul class="features-list">
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>Unlimited Employees</li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>All Features Included</li>
                    <li><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>Dedicated Support Agent</li>
                </ul>
                <button id="enterprise-plan-btn" class="btn btn-primary" data-plan-id="enterprise" style="width: 100%;">Choose Enterprise</button>
            </div>
        </section>
    </div>
    <div id="message-modal-overlay" class="modal-overlay">
        <div class="modal-content">
            <p id="modal-message-text"></p>
            <div class="modal-buttons">
                <button id="modal-close-button" class="btn btn-secondary">Close</button>
            </div>
        </div>
    </div>
    <script src="https://js.stripe.com/v3/"></script>
    <script src="js/app.min.js"></script>
</body>
</html>