// backend/test_chai.js
const chai = require('chai');
const chaiHttp = require('chai-http');

console.log('--- Testing Chai and Chai-HTTP setup ---');
console.log('chai object:', chai);
console.log('chaiHttp object:', chaiHttp);

chai.use(chaiHttp);
console.log('chai.use(chaiHttp) executed.');

// Check if chai.request is now a function
if (typeof chai.request === 'function') {
    console.log('SUCCESS: chai.request is a function!');
    console.log('Type of chai.request:', typeof chai.request);
} else {
    console.error('FAILURE: chai.request is NOT a function. Type:', typeof chai.request);
    console.error('This means chai-http failed to extend chai properly.');
}

console.log('--- Test complete ---');