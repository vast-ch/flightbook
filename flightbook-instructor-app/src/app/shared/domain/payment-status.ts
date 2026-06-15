export interface PaymentStatus {
    active: boolean
    expires_date?: Date;
    purchase_date?: Date;
    store?: string;
}