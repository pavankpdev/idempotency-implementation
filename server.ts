import dotenv from "dotenv";
import express, {
    type Request,
    type Response,
    type NextFunction,
    type ErrorRequestHandler
} from "express";
import cors from "cors";
import {
    validateSendSafePaymentRequest,
    validateSendUnsafePaymentRequest
} from "./utils/validation.js";
import type {
    PaymentRequest,
    SafePaymentRequest
} from "./types";
import {
    addHiccup,
    getHiccupsCount,
    resetHiccupsCount
} from "./utils/ops.js";
import AsyncLock from "async-lock";

import {
    randomUUID,
    createHash
} from "crypto";
import {
    db
} from "./db.js";

dotenv.config();

console.log('🚀 Starting server...');
console.log('📊 Environment:', {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000
});

const app = express();
const lock = new AsyncLock();

app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static('client'));
console.log('📁 Serving static files from ./client directory');

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.post("/unsafe-pay", async (req: Request < {}, any, PaymentRequest > , res) => {
    try {
        console.log('⚠️  POST /unsafe-pay - Processing unsafe payment');
        validateSendUnsafePaymentRequest(req.body);

    const {
        senderEmail,
        recipientEmail,
        amount
    } = req.body;

    const {
        balances: balancesDB
    } = db.data;

    const sender = balancesDB.find(({
        email
    }) => email === senderEmail);
    if (!sender) {
        return res.status(404).send("Sender not found");
    }

    if (sender.balance < amount) {
        return res.status(409).send("Insufficient funds");
    }

    const recipient = balancesDB.find(({
        email
    }) => email === recipientEmail);
    if (!recipient) {
        return res.status(404).send("Recipient not found");
    }

    const transferId = randomUUID()
    let newBalance: number;

    await db.update(({
        balances,
        transfers
    }) => {
        const senderBalance = balances.find(({
            email
        }) => email === senderEmail);
        const recipientBalance = balances.find(({
            email
        }) => email === recipientEmail);

        if (!senderBalance || !recipientBalance) {
            throw new Error("Balance update failed: sender or recipient not found");
        }

        senderBalance.balance -= amount;
        recipientBalance.balance += amount;

        transfers.push({
            id: transferId,
            senderEmail,
            recipientEmail,
            amount,
            status: "COMPLETED",
            createdAt: new Date(),
        })

        newBalance = senderBalance.balance
    });

    const hiccupKey = createHash("sha256").update([senderEmail, recipientEmail, amount].join("-")).digest("hex");

    const hiccupsCount = getHiccupsCount(hiccupKey);
    if (hiccupsCount >= 3) {
        resetHiccupsCount(hiccupKey);
        res.status(201).json({
            status: "COMPLETED",
            transferId,
            newBalance: newBalance!
        })
        return
    }

    addHiccup(hiccupKey);

    res.set("Retry-After", "1").status(503).json({
        message: "service unavailable",
        status: "processing"
    });
    return
    } catch (error) {
        console.error('❌ POST /unsafe-pay error:', error);
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.post("/safe-pay", async (req: Request < {}, any, SafePaymentRequest > , res) => {
    try {
        console.log('🛡️  POST /safe-pay - Processing safe payment');
        validateSendSafePaymentRequest(req.body);

    await lock.acquire(req.body.idempotencyKey, async () => {
        const {
            senderEmail,
            recipientEmail,
            amount,
            idempotencyKey
        } = req.body;

        const payloadHash = createHash("sha256").update([senderEmail, recipientEmail, amount].join("-")).digest("hex");

        const {
            balances: balancesDB,
            snapshots: snapshotsDB
        } = db.data;

        const snapshot = snapshotsDB.find(({
            id
        }) => id === idempotencyKey);

        if (snapshot) {
            if (snapshot.payloadHash !== payloadHash) {
                return res.status(409).send("Transfer intent doesn't match");
            }

            const {
                state,
                attemptCount,
                transferId
            } = snapshot;

            if (state === "COMPLETED") {
                const sender = db.data.balances.find(({
                    email
                }) => email === senderEmail);
                res.status(201).json({
                    status: "COMPLETED",
                    transferId,
                    newBalance: sender?.balance!
                })
                return
            }

            if (state === "PENDING") {
                await db.update(({
                    snapshots,
                    transfers,
                    balances
                }) => {
                    const sp = snapshots.find(({
                        id
                    }) => id === idempotencyKey);
                    if (attemptCount < 3) {
                        sp!.attemptCount += 1;
                    }

                    if (attemptCount >= 3) {
                        sp!.state = "COMPLETED";

                        const tfs = transfers.find(({
                            id
                        }) => id === transferId);
                        tfs!.status = "COMPLETED";

                        const recipient = balances.find(({
                            email
                        }) => email === recipientEmail);
                        recipient!.balance += amount;
                        tfs!.finalizedAt = new Date();
                    }
                })

                if (attemptCount < 3) {
                    res.set("Retry-After", "1").status(503).json({
                        message: "service unavailable",
                        status: "processing",
                        idempotencyKey,
                        transferId
                    });
                    return
                }

                const sender = db.data.balances.find(({
                    email
                }) => email === senderEmail);

                res.status(201).json({
                    status: "COMPLETED",
                    transferId,
                    newBalance: sender?.balance!
                })
                return
            }
        }

        const sender = balancesDB.find(({
            email
        }) => email === senderEmail);
        if (!sender) {
            return res.status(404).send("Sender not found");
        }

        if (sender.balance < amount) {
            return res.status(409).send("Insufficient funds");
        }

        const recipient = balancesDB.find(({
            email
        }) => email === recipientEmail);
        if (!recipient) {
            return res.status(404).send("Recipient not found");
        }

        const transferId = randomUUID()
        let newBalance: number;

        await db.update(({
            balances,
            transfers,
            snapshots
        }) => {
            const senderBalance = balances.find(({
                email
            }) => email === senderEmail);

            if (!senderBalance) {
                throw new Error("Balance update failed: sender or recipient not found");
            }

            senderBalance.balance -= amount;

            transfers.push({
                id: transferId,
                senderEmail,
                recipientEmail,
                amount,
                status: "PENDING",
                createdAt: new Date(),
            })

            newBalance = senderBalance.balance

            snapshots.push({
                id: idempotencyKey,
                payloadHash,
                transferId,
                state: "PENDING",
                attemptCount: 1,
            })
        });

        res.set("Retry-After", "1").status(503).json({
            message: "service unavailable",
            status: "processing",
            idempotencyKey,
            transferId
        });
        return
    })
    } catch (error) {
        console.error('❌ POST /safe-pay error:', error);
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.get("/balance", async (req, res) => {
    try {
        console.log('📊 GET /balance - Fetching user balances');
        const { balances } = db.data;
        console.log(`📊 Found ${balances.length} users in database`);
        res.json(balances);
    } catch (error) {
        console.error('❌ GET /balance error:', error);
        res.status(500).json({ error: 'Failed to fetch balances' });
    }
});

// Add error handling middleware
const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🎉 Server is running on port ${PORT}`);
    console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
    console.log('📋 Available endpoints:');
    console.log('  GET  /balance     - Fetch user balances');
    console.log('  POST /unsafe-pay  - Unsafe payment (3x retry)');
    console.log('  POST /safe-pay    - Safe payment (idempotent)');
});