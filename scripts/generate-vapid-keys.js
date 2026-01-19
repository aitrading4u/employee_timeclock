#!/usr/bin/env node

/**
 * Script to generate VAPID keys for push notifications
 * Run with: node scripts/generate-vapid-keys.js
 */

import webpush from "web-push";

console.log('Generating VAPID keys for push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated:\n');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('\n---\n');
console.log('Add these to your .env.local file:');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@timeclock.app`);
console.log('\nAlso add them to your production environment (Vercel/Render):');
console.log('- VAPID_PUBLIC_KEY');
console.log('- VAPID_PRIVATE_KEY');
console.log('- VAPID_SUBJECT (optional, defaults to mailto:admin@timeclock.app)');
