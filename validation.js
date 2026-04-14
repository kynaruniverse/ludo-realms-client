// Quick validation to ensure core modules load without error
import('./main.js').then(() => {
    console.log('✅ Game modules validated.');
}).catch(err => {
    console.error('❌ Validation failed:', err);
    process.exit(1);
});