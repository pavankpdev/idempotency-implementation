import type { Request } from "express";
import type { PaymentRequest, SafePaymentRequest } from "../types";

export const validateSendUnsafePaymentRequest = (body: PaymentRequest) => {
    if (!body) {
        throw new Error("Request body is empty");
    }

    if (!body.amount) {
        throw new Error("Amount is missing");
    }
    
    if(body.amount < 0) {   
        throw new Error("Amount must be positive");
    }

    if(body.amount === 0) {   
        throw new Error("Amount must be greater than 0");
    }

    if (!body.senderEmail) {
        throw new Error("Sender Email is missing");
    }

    if (!body.recipientEmail) {
        throw new Error("Recipient Email is missing");
    }
}

export const validateSendSafePaymentRequest = (body: SafePaymentRequest) => {
    if (!body) {
        throw new Error("Request body is empty");
    }

    if (!body.amount) {
        throw new Error("Amount is missing");
    }
      
    if(body.amount < 0) {   
        throw new Error("Amount must be positive");
    }

    if(body.amount === 0) {   
        throw new Error("Amount must be greater than 0");
    }

    if (!body.senderEmail) {
        throw new Error("Sender Email is missing");
    }

    if (!body.recipientEmail) {
        throw new Error("Recipient Email is missing");
    }

    if (!body.idempotencyKey) {
        throw new Error("Idempotency Key is missing");
    }
}