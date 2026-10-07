export interface PickingRequestIdentity {
  sequence: number;
  currentSequence: number;
  requestedBranchId: string;
  activeBranchId: string | null;
  requestedPickingOrderId?: string;
  selectedPickingOrderId?: string | null;
}

export function isCurrentPickingRequest(identity: PickingRequestIdentity): boolean {
  if (
    identity.sequence !== identity.currentSequence ||
    identity.requestedBranchId !== identity.activeBranchId
  ) {
    return false;
  }
  if (identity.requestedPickingOrderId === undefined) return true;
  return identity.requestedPickingOrderId === identity.selectedPickingOrderId;
}
