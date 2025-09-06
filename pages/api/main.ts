// pages/api/main.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from '../../lib/firebase-admin';

// Define RevenueCat event interface
interface RevenueCatEvent {
    app_user_id: string;
    product_id: string;
    new_product_id: string;
    expiration_at_ms: number;
    aliases: string[];
    original_app_user_id: string;
    subscriber_attributes: {
        $email?: {
            value: string;
            updated_at_ms: number;
        };
    };
    transaction_id: string;
    store: string;
    purchased_at_ms: number;
    country_code: string;
    currency: string;
    price: number;
    event_timestamp_ms: number;
    offer_code: string;
    expiration_reason: string;
    cancel_reason: string;
    type: 'TEST' | 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'UNCANCELLATION' | 'NON_RENEWING_PURCHASE' | 'SUBSCRIPTION_PAUSED' | 'BILLING_ISSUE' | 'EXPIRATION' | 'PRODUCT_CHANGE' | 'SUBSCRIPTION_EXTENDED';
}

// Replace hardcoded CREDIT_MAP with a function to get credits from Firestore
async function getCreditMap() {
    const configs = await firestore.collection('subscription_configs').get();
    const creditMap: Record<string, number> = {};
    
    configs.docs.forEach(doc => {
        if (doc.id === 'sub_monthly_1') creditMap['sub_monthly_1'] = doc.data().credits;
        if (doc.id === 'sub_weekly_1') creditMap['sub_weekly_1'] = doc.data().credits;
        if (doc.id === 'sub_yearly_1') creditMap['sub_yearly_1'] = doc.data().credits;
    });
    
    return creditMap;
}
// Modify handleInitialPurchase to use dynamic credit map
const handleInitialPurchase = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const productId = event.product_id;
    const creditMap = await getCreditMap();
    const userRef = firestore.collection('users').doc(userId);

    // Check if user document exists
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        // Create new user with initial credits
        await userRef.set({
            credits: creditMap[productId] || 0,
            subscription: {
                type: productId,
                status: 'active',
                expiresAt: new Date(event.expiration_at_ms),
                createdAt: FieldValue.serverTimestamp()
            },
        });
    } else {
        // Update existing user //TODO: kalan kredileri bir yere kaydetip sifirlama
        await userRef.update({
            credits: FieldValue.increment(creditMap[productId] || 0),
            'subscription.type': productId,
            'subscription.status': 'active',
            'subscription.expiresAt': new Date(event.expiration_at_ms)
        });
    }
    // Merge subscriber attributes
    await userRef.set({
        subscriber_attributes: {
            ...event.subscriber_attributes,
            last_purchase: {
                transaction_id: event.transaction_id,
                store: event.store
            }
        }
    }, { merge: true });
};

const handleRenewal = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const productId = event.product_id;
    const creditMap = await getCreditMap();
    const userRef = firestore.collection('users').doc(userId);
    await userRef.update({
        'credits': creditMap[productId],
        'subscription.expiresAt': new Date(event.expiration_at_ms),
        'subscription.renewalCount': FieldValue.increment(1),
        'subscription.lastRenewalDate': FieldValue.serverTimestamp(),
        'subscription.renewalHistory': FieldValue.arrayUnion({
            transactionId: event.transaction_id,
            date: new Date(event.purchased_at_ms),
            price: event.price,
            currency: event.currency,
            country: event.country_code
        }),
        'subscription.status': 'active'
    });

    // Update payment history
    await userRef.set({
        payment_history: FieldValue.arrayUnion({
            type: 'renewal',
            amount: event.price,
            currency: event.currency,
            transaction_date: new Date(event.purchased_at_ms),
            transaction_id: event.transaction_id,
            store: event.store
        })
    }, { merge: true });
};


const handleCancellation = async (event: RevenueCatEvent) => {
    if (event.cancel_reason === 'CUSTOMER_SUPPORT') {
        // Handle refund scenario
        await handleRefund(event);
        return;
    }
    const userId = event.app_user_id;
    const userRef = firestore.collection('users').doc(userId);

    await userRef.update({
        credits: 0, // Reset credits to zero
        'subscription.status': 'canceled',
        'subscription.cancelledAt': FieldValue.serverTimestamp(),
        'subscription.expiresAt': new Date(event.expiration_at_ms), // Maintain expiration date
        'subscription.lastCancellation': {
            transactionId: event.transaction_id,
            date: new Date(event.event_timestamp_ms),
            offerCode: event.offer_code
        },
        'subscription.leftOverCredits': (await userRef.get()).data()?.credits || 0
    });
};

const handleUncancellation = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const userRef = firestore.collection('users').doc(userId);
    const creditMap = await getCreditMap();

    const userDoc = await userRef.get();
    const subscriptionData = userDoc.data()?.subscription || {};

    await userRef.update({
        credits: subscriptionData.leftOverCredits || creditMap[event.product_id] || 0,
        'subscription.status': 'active',
        'subscription.expiresAt': new Date(event.expiration_at_ms),
        'subscription.type': event.product_id,
        'subscription.uncancelledAt': FieldValue.serverTimestamp(),
        'subscription.leftOverCredits': FieldValue.delete() // Clear after restoration
    });

    // Restore any removed attributes
    await userRef.set({
        subscription: {
            ...subscriptionData,
            cancellationHistory: FieldValue.arrayRemove({
                timestamp: subscriptionData.cancelledAt
            })
        }
    }, { merge: true });
};

const handleExpiration = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const userRef = firestore.collection('users').doc(userId);

    await userRef.update({
        credits: 0, // Reset credits to zero
        'subscription.status': 'expired',
        'subscription.expiredAt': FieldValue.serverTimestamp(),
        'subscription.expirationReason': event.expiration_reason || 'natural',
        'subscription.finalExpirationDate': new Date(event.expiration_at_ms)
    });

    // Record full expiration context
    await userRef.set({
        expirationHistory: FieldValue.arrayUnion({
            timestamp: new Date(event.event_timestamp_ms),
            productId: event.product_id,
            reason: event.expiration_reason,
            lastTransaction: event.transaction_id,
            attributes: event.subscriber_attributes
        })
    }, { merge: true });
};

// Refund-specific handler
const handleRefund = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const userRef = firestore.collection('users').doc(userId);

    await userRef.update({
        credits: 0,
        'subscription.status': 'refunded',
        'subscription.refundedAt': FieldValue.serverTimestamp(),
        'subscription.refundAmount': event.price, // Original purchase price
        'subscription.refundCurrency': event.currency
    });

    // Mark transaction as refunded in payment history
    await userRef.set({
        payment_history: FieldValue.arrayUnion({
            type: 'refund',
            amount: -event.price, // Negative amount for financial reporting
            currency: event.currency,
            transaction_date: new Date(event.event_timestamp_ms),
            transaction_id: event.transaction_id,
            reason: event.cancel_reason
        })
    }, { merge: true });
};

const handleProductChange = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const userRef = firestore.collection('users').doc(userId);
    const creditMap = await getCreditMap();

    // Get current subscription details
    const userDoc = await userRef.get();
    const currentProduct = event.product_id;
    const currentCredits = userDoc.data()?.credits || 0;

    // Get credit values
    const oldCredit = creditMap[currentProduct] || 0;
    const newCredit = creditMap[event.new_product_id] || 0;
    const creditDifference = newCredit - oldCredit;

    // Calculate credit adjustment
    let creditUpdate = 0;
    if (newCredit > oldCredit) {
        // Upgrade - add difference
        creditUpdate = creditDifference;
    } else if (newCredit < oldCredit) {
        const usedCredits = oldCredit - currentCredits; // kullanilan kredi miktari
        if (usedCredits > newCredit){
            creditUpdate = 0 // bize borclu kaliyor
        } else{
            creditUpdate = newCredit - usedCredits
        }
    }

    // Perform update
    await userRef.update({
        credits: creditUpdate,
        'subscription.type': event.product_id,
        'subscription.expiresAt': new Date(event.expiration_at_ms),
        'subscription.previousProducts': FieldValue.arrayUnion(currentProduct),
        'subscription.lastChanged': FieldValue.serverTimestamp()
    });

    // Track credit changes
    await userRef.set({
        creditHistory: FieldValue.arrayUnion({
            date: new Date(event.event_timestamp_ms),
            oldProduct: currentProduct,
            newProduct: event.product_id,
            creditChange: creditUpdate,
            remainingCredits: currentCredits + creditUpdate
        })
    }, { merge: true });
};

const handleSubscriptionExtended = async (event: RevenueCatEvent) => {
    const userId = event.app_user_id;
    const userRef = firestore.collection('users').doc(userId);

    // Get current expiration before update
    const userDoc = await userRef.get();
    const currentExpiration = userDoc.data()?.subscription?.expiresAt;

    await userRef.update({
        'subscription.expiresAt': new Date(event.expiration_at_ms),
        'subscription.extensionCount': FieldValue.increment(1),
        'subscription.status': 'extended' // Special status for tracking
    });

    // Record extension context
    await userRef.set({
        extensionHistory: FieldValue.arrayUnion({
            extendedAt: new Date(event.event_timestamp_ms),
            previousExpiration: currentExpiration,
            newExpiration: new Date(event.expiration_at_ms),
            reason: 'payment_retry', // Could be parameterized if API provides it
            store: event.store,
            transactionId: event.transaction_id
        })
    }, { merge: true });

    // Maintain service access during grace period
    await userRef.update({
        'subscription.gracePeriod': true,
        'subscription.originalExpiration': currentExpiration
    });
};

// const handleNonRenewingPurchase = async (event: RevenueCatEvent) => {
//     const userId = event.app_user_id;
//     const expirationDate = new Date(event.purchased_at_ms + 30 * 86400 * 1000); // 30 days

//     await firestore.collection('users').doc(userId).update({
//         'subscription.status': 'active',
//         'subscription.expiresAt': expirationDate,
//         'subscription.type': 'non_renewing'
//     });
// };

// Update event handlers type
type EventHandler = (event: RevenueCatEvent) => Promise<void>;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        console.log('RevenueCat Webhook Request:', {
            eventType: req.body.event?.type,
            timestamp: new Date().toISOString()
        });

        const authHeader = req.headers.authorization;
        if (authHeader !== 'xxx') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const eventType = req.body.event.type;
        const eventHandlers: Record<string, EventHandler> = {
            INITIAL_PURCHASE: handleInitialPurchase,
            RENEWAL: handleRenewal,
            CANCELLATION: handleCancellation,
            EXPIRATION: handleExpiration,
            UNCANCELLATION: handleUncancellation,
            PRODUCT_CHANGE: handleProductChange,
            SUBSCRIPTION_EXTENDED: handleSubscriptionExtended,
            // NON_RENEWING_PURCHASE: handleNonRenewingPurchase, \\ We dont need it, might activate this later
            // TRANSFER: handleTransfer, // We dont need it
        };

        if (eventHandlers[eventType]) {
            await eventHandlers[eventType](req.body.event);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: 'Unsupported event type' });
        }

    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}