export interface StorefrontCheckoutFormDto {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  department?: string;
  references?: string;
  cardholderName: string;
  cardLastFour: string;
}

export interface StorefrontCheckoutResultDto {
  orderNumber: string;
  trackingToken: string;
  total: number;
}
