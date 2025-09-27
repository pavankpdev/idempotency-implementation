export interface PaymentRequest {
    amount: number;
    senderEmail: string;
    recipientEmail: string;
}

export interface SafePaymentRequest extends PaymentRequest {
    idempotencyKey: string;
}

export interface Transfer {
    id: string;
    senderEmail: string;
    recipientEmail: string;
    amount: number; 
    createdAt: Date;
    status: "PENDING" | "COMPLETED";
    finalizedAt?: Date;
}

export interface Balance {
    id: string;
    full_name: string;
    email: string;
    balance: number;
}

export interface Snapshots {
    id: string;
    payloadHash: string;
    transferId: string;
    state: "PENDING" | "COMPLETED";
    attemptCount: number;
}