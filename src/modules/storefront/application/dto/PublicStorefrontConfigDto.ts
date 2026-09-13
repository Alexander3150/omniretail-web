export interface PublicStorefrontBranchDto {
  id: string;
  name: string;
  address?: string;
}

export interface PublicStorefrontConfigDto {
  storeName: string;
  storeEnabled: boolean;
  accountRequired: boolean;
  guestTrackingEnabled: boolean;
  contactPhone?: string;
  contactEmail?: string;
  branches: PublicStorefrontBranchDto[];
}
